import { URL_RE } from "./urls";

export type RedactionType =
  | "CURP"
  | "RFC"
  | "CARD"
  | "CLABE"
  | "PHONE"
  | "EMAIL"
  | "SECRET";

export interface RedactionMatch {
  type: RedactionType;
  count: number;
}

export interface RedactResult {
  clean: string;
  found: RedactionMatch[];
}

// Order the categories are reported in (matches docs/PACKET.md's listing).
const REPORT_ORDER: RedactionType[] = [
  "CURP",
  "RFC",
  "CARD",
  "CLABE",
  "PHONE",
  "EMAIL",
  "SECRET",
];

// Private-use Unicode delimiters wrapping an index: these code points can't
// appear in real pasted text, so restoring URLs afterward can't collide
// with a message that happens to literally contain a plain placeholder
// word (e.g. a message that contains "URL" itself).
const URL_MARK_OPEN = "";
const URL_MARK_CLOSE = "";
const URL_MARK_RE = new RegExp(`${URL_MARK_OPEN}(\\d+)${URL_MARK_CLOSE}`, "g");

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

// Messages may be in Spanish or English, so each keyword has both forms
// where they differ ("código"/"codigo"/"code", "contraseña"/"password").
const SECRET_KEYWORDS_RE =
  /\b(contraseña|contrasena|password|nip|pin|código|codigo|code|token|clave)\b(\s*(?:es|is|[:=])?\s*)([^\s.,;!?]+)/gi;

// Standard 18-character CURP shape: 4 letters, YYMMDD, sex, state, 3 consonants, homoclave, check digit.
const CURP_RE =
  /\b[A-Z][AEIOUX][A-Z]{2}\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])[HM](?:AS|BC|BS|CC|CS|CH|CL|CM|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QO|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS)[B-DF-HJ-NP-TV-Z]{3}[A-Z0-9]\d\b/gi;

// Standard RFC shape: 3 (persona moral) or 4 (persona física) letters, YYMMDD, 3-char homoclave.
const RFC_RE = /\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b/gi;

const CLABE_RE = /(?<!\d)\d{18}(?!\d)/g;

// 13-19 digits, spaces/dashes allowed between digits; Luhn-checked before accepting.
const CARD_CANDIDATE_RE = /(?<!\d)\d(?:[ -]?\d){12,18}(?!\d)/g;

// Mexican phone: 10 digits, optional +52/52 country code, common space/dash groupings.
const PHONE_CANDIDATE_RE =
  /(?<!\d)(?:\+?52[\s-]?)?\d{2,3}[\s-]?\d{3,4}[\s-]?\d{4}(?!\d)/g;

function luhnValid(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

export function redact(text: string): RedactResult {
  const counts: Record<RedactionType, number> = {
    CURP: 0,
    RFC: 0,
    CARD: 0,
    CLABE: 0,
    PHONE: 0,
    EMAIL: 0,
    SECRET: 0,
  };

  // Protect URLs first so no later pattern can touch digits/text inside them.
  const urls: string[] = [];
  let clean = text.replace(URL_RE, (match) => {
    const marker = `${URL_MARK_OPEN}${urls.length}${URL_MARK_CLOSE}`;
    urls.push(match);
    return marker;
  });

  clean = clean.replace(EMAIL_RE, () => {
    counts.EMAIL++;
    return "[EMAIL HIDDEN]";
  });

  clean = clean.replace(SECRET_KEYWORDS_RE, (_match, kw, connector) => {
    counts.SECRET++;
    return `${kw}${connector}[SECRET HIDDEN]`;
  });

  clean = clean.replace(CURP_RE, () => {
    counts.CURP++;
    return "[CURP HIDDEN]";
  });

  clean = clean.replace(RFC_RE, () => {
    counts.RFC++;
    return "[RFC HIDDEN]";
  });

  clean = clean.replace(CLABE_RE, () => {
    counts.CLABE++;
    return "[CLABE HIDDEN]";
  });

  clean = clean.replace(CARD_CANDIDATE_RE, (match) => {
    const digits = match.replace(/[ -]/g, "");
    if (!luhnValid(digits)) return match;
    counts.CARD++;
    return "[CARD HIDDEN]";
  });

  clean = clean.replace(PHONE_CANDIDATE_RE, (match) => {
    const digits = match.replace(/[\s+-]/g, "");
    const isPlain10 = digits.length === 10;
    const isWithCountryCode = digits.length === 12 && digits.startsWith("52");
    if (!isPlain10 && !isWithCountryCode) return match;
    counts.PHONE++;
    return "[PHONE HIDDEN]";
  });

  clean = clean.replace(URL_MARK_RE, (_match, i) => urls[Number(i)]);

  const found = REPORT_ORDER.filter((type) => counts[type] > 0).map(
    (type) => ({ type, count: counts[type] }),
  );

  return { clean, found };
}
