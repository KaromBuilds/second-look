import { NextResponse } from "next/server";
import { friendlyCheckError } from "@/lib/checkLimits";
import { checkUrls } from "@/lib/safeBrowsing";
import { extractUrls, toHostname } from "@/lib/urls";

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

  const safeBrowsing = await checkUrls(urls);

  // Placeholder response — Feature 6 will replace this with the real
  // Gemini verdict, built from this link check plus the pattern-library
  // match from Feature 4.
  return NextResponse.json({
    placeholder: true,
    textLength: text.length,
    urls: urls.map(toHostname),
    dangerous_link: safeBrowsing.dangerousUrls.length > 0,
    flagged_domains: safeBrowsing.dangerousUrls.map(toHostname),
    link_check_unavailable: urls.length > 0 && !safeBrowsing.available,
  });
}
