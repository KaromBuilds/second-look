// Shared between the client (app/page.tsx, for instant feedback and to
// avoid calling the API at all with invalid input) and the server
// (app/api/check/route.ts, which re-validates independently) so the two
// never drift apart.
export const MIN_TEXT_LENGTH = 10;
export const MAX_TEXT_LENGTH = 2000;
export const MAX_URLS = 5;

export function friendlyCheckError(
  text: string,
  urlCount: number,
): string | null {
  if (text.trim().length === 0) {
    return "Please paste a message first.";
  }
  if (text.length < MIN_TEXT_LENGTH) {
    return `That message is too short to check (at least ${MIN_TEXT_LENGTH} characters).`;
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return `That message is too long to check (max ${MAX_TEXT_LENGTH.toLocaleString()} characters). Please paste a shorter excerpt.`;
  }
  if (urlCount > MAX_URLS) {
    return `That message has too many links to check (max ${MAX_URLS}).`;
  }
  return null;
}
