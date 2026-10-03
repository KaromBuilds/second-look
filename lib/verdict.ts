export type VerdictLabel = "likely_scam" | "suspicious" | "looks_ok";

export interface Verdict {
  verdict: VerdictLabel;
  scam_type: string;
  confidence: number;
  red_flags: string[];
  steps: [string, string, string];
  escalate: boolean;
  explanation: string;
  // UI-facing provenance, not part of Gemini's own JSON contract:
  source: "gemini" | "basic";
}

const ESCALATE_CONFIDENCE_THRESHOLD = 60;

// The packet's escalate rule is enforced here, independent of whatever a
// model returns for its own `escalate` field, so it can never be
// silently skipped by a model that ignores the instruction: confidence
// below the threshold or a confirmed-dangerous link always escalates,
// regardless of what produced the rest of the verdict.
export function shouldEscalate(args: {
  confidence: number;
  dangerousLink: boolean;
  modelEscalate?: boolean;
}): boolean {
  return (
    Boolean(args.modelEscalate) ||
    args.confidence < ESCALATE_CONFIDENCE_THRESHOLD ||
    args.dangerousLink
  );
}

const GENERIC_SAFE_STEPS: [string, string, string] = [
  "Do not click any links or pay anything from this message",
  "Contact the sender through a number or channel you already have, not this message",
  "If you're unsure, treat it as a scam and do not respond",
];

// Used when Gemini is unavailable (missing key, API failure, or two
// malformed responses in a row). Built entirely from the Feature 4
// pattern library and the Feature 5 link check — no AI involved, so the
// confidence is deliberately kept low, which (via shouldEscalate) always
// recommends human help rather than quietly saying "looks_ok" without
// having actually verified anything.
export function buildFallbackVerdict(args: {
  pattern: { name: string; red_flags: string[]; safe_steps: string[] } | null;
  dangerousLink: boolean;
}): Verdict {
  const { pattern, dangerousLink } = args;
  const confidence = pattern ? 55 : 35;

  return {
    verdict: pattern ? "likely_scam" : "suspicious",
    scam_type: pattern ? pattern.name : "Unclear — AI check unavailable",
    confidence,
    red_flags: pattern
      ? pattern.red_flags
      : ["We could not run the full AI check on this message"],
    steps: pattern
      ? ([...pattern.safe_steps] as [string, string, string])
      : GENERIC_SAFE_STEPS,
    escalate: shouldEscalate({ confidence, dangerousLink }),
    explanation: "Basic check (AI unavailable).",
    source: "basic",
  };
}
