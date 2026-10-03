const THREAT_TYPES = [
  "MALWARE",
  "SOCIAL_ENGINEERING",
  "UNWANTED_SOFTWARE",
  "POTENTIALLY_HARMFUL_APPLICATION",
];

const API_URL = "https://safebrowsing.googleapis.com/v4/threatMatches:find";

export interface SafeBrowsingResult {
  // false only when the lookup itself failed (network error, bad response,
  // missing key) — not when it succeeded and found nothing dangerous.
  available: boolean;
  dangerousUrls: string[];
}

interface ThreatMatchesResponse {
  matches?: Array<{ threat: { url: string } }>;
}

// Looks up each URL with the Safe Browsing Lookup API v4. Never throws —
// a failed lookup (missing key, network error, non-2xx response) comes
// back as { available: false, dangerousUrls: [] } so the caller can
// continue the check and say "Link check unavailable right now" instead
// of failing the whole request over a third-party API hiccup.
export async function checkUrls(urls: string[]): Promise<SafeBrowsingResult> {
  if (urls.length === 0) {
    return { available: true, dangerousUrls: [] };
  }

  const apiKey = process.env.SAFE_BROWSING_API_KEY;
  if (!apiKey) {
    return { available: false, dangerousUrls: [] };
  }

  try {
    const response = await fetch(`${API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client: { clientId: "second-look", clientVersion: "1.0.0" },
        threatInfo: {
          threatTypes: THREAT_TYPES,
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          threatEntries: urls.map((url) => ({ url })),
        },
      }),
    });

    if (!response.ok) {
      return { available: false, dangerousUrls: [] };
    }

    const data = (await response.json()) as ThreatMatchesResponse;
    const dangerousUrls = [...new Set((data.matches ?? []).map((m) => m.threat.url))];
    return { available: true, dangerousUrls };
  } catch {
    return { available: false, dangerousUrls: [] };
  }
}
