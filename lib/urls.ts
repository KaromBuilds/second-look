export const URL_RE = /\bhttps?:\/\/\S+/gi;

export function extractUrls(text: string): string[] {
  return text.match(URL_RE) ?? [];
}
