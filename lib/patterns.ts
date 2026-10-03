import patternsData from "../data/patterns.json";

export interface ScamPattern {
  id: string;
  name: string;
  keywords: string[];
  red_flags: string[];
  safe_steps: string[];
  simulated: true;
}

export interface PatternMatch {
  pattern: ScamPattern;
  score: number;
  matchedKeywords: string[];
}

const patterns = patternsData as ScamPattern[];

// \p{Mn} = "nonspacing mark": after NFD decomposition, an accented letter
// becomes base letter + a combining mark codepoint in this category, so
// this strips exactly the accents and nothing else.
const DIACRITICS_RE = /\p{Mn}/gu;

// Messages may be in Spanish or English (see each pattern's bilingual
// `keywords`), and Spanish text may or may not carry accents — normalize
// both the input and the keywords the same way before comparing.
function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(DIACRITICS_RE, "");
}

// Scores every pattern by how many of its keywords appear in the text and
// returns the top match, or null if nothing matched at all.
export function matchPattern(text: string): PatternMatch | null {
  const normalizedText = normalize(text);
  let best: PatternMatch | null = null;

  for (const pattern of patterns) {
    const matchedKeywords = pattern.keywords.filter((keyword) =>
      normalizedText.includes(normalize(keyword)),
    );
    const score = matchedKeywords.length;
    if (score > 0 && (!best || score > best.score)) {
      best = { pattern, score, matchedKeywords };
    }
  }

  return best;
}
