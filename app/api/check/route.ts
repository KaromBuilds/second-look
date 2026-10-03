import { NextResponse } from "next/server";
import { friendlyCheckError } from "@/lib/checkLimits";
import { extractUrls } from "@/lib/urls";

// Never log req.text anywhere in this file — it may still contain
// whatever the client-side redaction in lib/redact.ts missed, and the
// packet's zero-data rule applies on the server too.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "We couldn't read that message. Please try again." },
      { status: 400 },
    );
  }

  const text = (body as { text?: unknown } | null)?.text;

  if (typeof text !== "string") {
    return NextResponse.json(
      { error: "Please paste a message first." },
      { status: 400 },
    );
  }

  const urls = extractUrls(text);
  const error = friendlyCheckError(text, urls.length);
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  // Placeholder response — Features 4-6 will replace this with the real
  // pattern-library match, Safe Browsing link check, and Gemini verdict.
  return NextResponse.json({
    placeholder: true,
    textLength: text.length,
    urls: urls.map((url) => {
      try {
        return new URL(url).hostname;
      } catch {
        return url;
      }
    }),
  });
}
