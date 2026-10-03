import { shouldEscalate, type Verdict, type VerdictLabel } from "./verdict";

const VERDICT_LABELS: VerdictLabel[] = ["likely_scam", "suspicious", "looks_ok"];

// Bounds each attempt so a slow or hanging Gemini response can't stall
// the whole /api/check request — the packet's "under 30 seconds" budget
// covers the full check, and this still leaves room for one retry.
const REQUEST_TIMEOUT_MS = 10_000;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    verdict: { type: "STRING", enum: VERDICT_LABELS },
    scam_type: { type: "STRING" },
    confidence: { type: "NUMBER" },
    red_flags: { type: "ARRAY", items: { type: "STRING" } },
    steps: {
      type: "ARRAY",
      items: { type: "STRING" },
      minItems: 3,
      maxItems: 3,
    },
    escalate: { type: "BOOLEAN" },
    explanation: { type: "STRING" },
  },
  required: [
    "verdict",
    "scam_type",
    "confidence",
    "red_flags",
    "steps",
    "escalate",
    "explanation",
  ],
};

const SYSTEM_INSTRUCTION = `You help a small Mexican business owner who is not technical decide whether a message he received (WhatsApp, SMS or email) is a scam.

Rules, all mandatory:
- Answer in simple English a non-technical business owner can understand. No jargon.
- Never ask the user for any personal data (no CURP, RFC, card numbers, passwords, codes, etc.) — some private details in the message have already been replaced with tags like "[PHONE HIDDEN]" before you see it; treat those tags as evidence the message asked for that kind of information, not as something to request yourself.
- Never tell the user to click any link that appears in the message.
- Whenever the message claims to be from someone the user already knows (a supplier, their bank, a family member, a coworker), at least one of the 3 steps must tell them to contact that person or institution through a phone number or channel they already have — not any contact info from the message itself.
- "steps" must contain exactly 3 short, concrete actions.
- "explanation" must be at most 2 sentences.
- "confidence" is 0-100: how confident you are in the verdict.
- Set "escalate" to true if your confidence is below 60, if you were told a dangerous link was found, or if the message indicates money has already been sent.
- Respond with JSON only, matching the required schema exactly.`;

interface AnalyzeInput {
  text: string;
  pattern: { name: string; red_flags: string[] } | null;
  dangerousLink: boolean;
}

function buildPrompt({ text, pattern, dangerousLink }: AnalyzeInput): string {
  const patternLine = pattern
    ? `Pattern library (simulated reference data, not proof by itself) suggests this may be: ${pattern.name}.`
    : "No match in the simulated pattern library.";
  const linkLine = dangerousLink
    ? "A link in this message was flagged as dangerous by Google Safe Browsing."
    : "No dangerous links were found in this message (or it has none).";

  return `Message to analyze (private details were already redacted by the user's browser before this reached you):
"""
${text}
"""

${patternLine}
${linkLine}`;
}

function isValidVerdictShape(value: unknown): value is Omit<Verdict, "source"> {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.verdict === "string" &&
    (VERDICT_LABELS as string[]).includes(v.verdict) &&
    typeof v.scam_type === "string" &&
    typeof v.confidence === "number" &&
    v.confidence >= 0 &&
    v.confidence <= 100 &&
    Array.isArray(v.red_flags) &&
    v.red_flags.every((f) => typeof f === "string") &&
    Array.isArray(v.steps) &&
    v.steps.length === 3 &&
    v.steps.every((s) => typeof s === "string") &&
    typeof v.escalate === "boolean" &&
    typeof v.explanation === "string"
  );
}

async function callGeminiOnce(input: AnalyzeInput): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL;
  if (!apiKey || !model) {
    throw new Error("Gemini is not configured");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ role: "user", parts: [{ text: buildPrompt(input) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini API responded with ${response.status}`);
  }

  const data = await response.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof raw !== "string") {
    throw new Error("Gemini response had no text content");
  }

  return JSON.parse(raw);
}

// Calls Gemini and validates the JSON shape, retrying once on a malformed
// response (per the packet's "validate the JSON and retry once"). Never
// throws — any failure after the retry comes back as `null` so the
// caller can fall back to the pattern-library-only verdict instead of
// failing the whole request.
export async function analyzeWithGemini(
  input: AnalyzeInput,
): Promise<Verdict | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const parsed = await callGeminiOnce(input);
      if (isValidVerdictShape(parsed)) {
        return {
          ...parsed,
          steps: parsed.steps as [string, string, string],
          escalate: shouldEscalate({
            confidence: parsed.confidence,
            dangerousLink: input.dangerousLink,
            modelEscalate: parsed.escalate,
          }),
          source: "gemini",
        };
      }
    } catch {
      // fall through to retry, or to returning null after the loop
    }
  }

  return null;
}
