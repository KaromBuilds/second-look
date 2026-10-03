import { afterEach, describe, expect, it, vi } from "vitest";
import { checkUrls } from "./safeBrowsing";

function mockFetchOnce(response: Partial<Response> & { ok: boolean; json?: () => Promise<unknown> }) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("checkUrls", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("returns available with no dangerous URLs when there are no URLs to check, without calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkUrls([]);

    expect(result).toEqual({ available: true, dangerousUrls: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports unavailable (not a false 'safe') when the API key is missing", async () => {
    vi.stubEnv("SAFE_BROWSING_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkUrls(["http://example.com"]);

    expect(result).toEqual({ available: false, dangerousUrls: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("flags a URL that comes back in the threatMatches response", async () => {
    vi.stubEnv("SAFE_BROWSING_API_KEY", "test-key");
    mockFetchOnce({
      ok: true,
      json: async () => ({
        matches: [{ threat: { url: "http://malware.testing.google.test/testing/malware/" } }],
      }),
    });

    const result = await checkUrls(["http://malware.testing.google.test/testing/malware/"]);

    expect(result.available).toBe(true);
    expect(result.dangerousUrls).toEqual([
      "http://malware.testing.google.test/testing/malware/",
    ]);
  });

  it("reports no dangerous URLs when the API returns no matches", async () => {
    vi.stubEnv("SAFE_BROWSING_API_KEY", "test-key");
    mockFetchOnce({ ok: true, json: async () => ({}) });

    const result = await checkUrls(["http://example.com"]);

    expect(result).toEqual({ available: true, dangerousUrls: [] });
  });

  it("dedupes repeated matches for the same URL", async () => {
    vi.stubEnv("SAFE_BROWSING_API_KEY", "test-key");
    mockFetchOnce({
      ok: true,
      json: async () => ({
        matches: [
          { threat: { url: "http://evil.example.com" } },
          { threat: { url: "http://evil.example.com" } },
        ],
      }),
    });

    const result = await checkUrls(["http://evil.example.com"]);

    expect(result.dangerousUrls).toEqual(["http://evil.example.com"]);
  });

  it("reports unavailable, not dangerous, on a non-2xx response", async () => {
    vi.stubEnv("SAFE_BROWSING_API_KEY", "test-key");
    mockFetchOnce({ ok: false });

    const result = await checkUrls(["http://example.com"]);

    expect(result).toEqual({ available: false, dangerousUrls: [] });
  });

  it("reports unavailable, not dangerous, and never throws on a network error", async () => {
    vi.stubEnv("SAFE_BROWSING_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );

    const result = await checkUrls(["http://example.com"]);

    expect(result).toEqual({ available: false, dangerousUrls: [] });
  });

  it("never sends the API key anywhere but the request URL's query string", async () => {
    vi.stubEnv("SAFE_BROWSING_API_KEY", "super-secret-key");
    const fetchMock = mockFetchOnce({ ok: true, json: async () => ({}) });

    await checkUrls(["http://example.com"]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("key=super-secret-key");
    expect(JSON.stringify(init.body)).not.toContain("super-secret-key");
  });
});
