export const URL_RE = /\bhttps?:\/\/\S+/gi;

export function extractUrls(text: string): string[] {
  return text.match(URL_RE) ?? [];
}

// Never show a full URL back to the user — only the domain, so nothing
// from a query string or path (which could contain tracking data or,
// in theory, something the redaction step missed) ends up on screen.
export function toHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
