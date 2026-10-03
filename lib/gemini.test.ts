import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeWithGemini } from "./gemini";

const VALID_VERDICT = {
  verdict: "likely_scam",
  scam_type: "Supplier bank account change",
  confidence: 90,
  red_flags: ["Asks for payment to a new account"],
  steps: ["Step one", "Step two", "Step three"],
  escalate: false,
  explanation: "This looks like a supplier impersonation scam.",
};

function geminiResponse(text: string) {
  return {
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text }] } }],
    }),
  };
}

const INPUT = { text: "test message", pattern: null, dangerousLink: false };

describe("analyzeWithGemini", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("returns null without calling fetch when Gemini isn't configured", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("GEMINI_MODEL", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzeWithGemini(INPUT);

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("parses a valid response and recomputes escalate via the shared rule", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_MODEL", "gemini-flash-latest");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(geminiResponse(JSON.stringify(VALID_VERDICT))),
    );

    const result = await analyzeWithGemini({ ...INPUT, dangerousLink: false });

    expect(result?.verdict).toBe("likely_scam");
    expect(result?.source).toBe("gemini");
    // model said confidence 90 and escalate:false, and no dangerous link —
    // shouldEscalate should agree: false.
    expect(result?.escalate).toBe(false);
  });

  it("parses a looks_ok verdict for a harmless message just as readily as a scam verdict", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_MODEL", "gemini-flash-latest");
    const harmless = {
      verdict: "looks_ok",
      scam_type: "None",
      confidence: 92,
      red_flags: [],
      steps: ["No action needed", "Keep an eye out for anything unusual", "Enjoy your order"],
      escalate: false,
      explanation: "This message has no signs of being a scam.",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(geminiResponse(JSON.stringify(harmless))),
    );

    const result = await analyzeWithGemini({
      text: "Su pedido está listo, pase el viernes.",
      pattern: null,
      dangerousLink: false,
    });

    expect(result?.verdict).toBe("looks_ok");
    expect(result?.escalate).toBe(false);
  });

  it("overrides the model's own escalate:false when confidence is below 60", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_MODEL", "gemini-flash-latest");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        geminiResponse(
          JSON.stringify({ ...VALID_VERDICT, confidence: 40, escalate: false }),
        ),
      ),
    );

    const result = await analyzeWithGemini(INPUT);

    expect(result?.escalate).toBe(true);
  });

  it("overrides escalate:false when a dangerous link was found", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_MODEL", "gemini-flash-latest");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        geminiResponse(JSON.stringify({ ...VALID_VERDICT, escalate: false })),
      ),
    );

    const result = await analyzeWithGemini({ ...INPUT, dangerousLink: true });

    expect(result?.escalate).toBe(true);
  });

  it("retries once on a malformed JSON response, then succeeds", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_MODEL", "gemini-flash-latest");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(geminiResponse("not valid json"))
      .mockResolvedValueOnce(geminiResponse(JSON.stringify(VALID_VERDICT)));
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzeWithGemini(INPUT);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result?.verdict).toBe("likely_scam");
  });

  it("retries once on a response missing required fields, then succeeds", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_MODEL", "gemini-flash-latest");
    const incomplete = { ...VALID_VERDICT, steps: ["only one step"] };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(geminiResponse(JSON.stringify(incomplete)))
      .mockResolvedValueOnce(geminiResponse(JSON.stringify(VALID_VERDICT)));
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzeWithGemini(INPUT);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result?.steps).toHaveLength(3);
  });

  it("returns null after two malformed responses in a row, without throwing", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_MODEL", "gemini-flash-latest");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(geminiResponse("still not json")),
    );

    const result = await analyzeWithGemini(INPUT);

    expect(result).toBeNull();
  });

  it("returns null, not a throw, on a network error", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_MODEL", "gemini-flash-latest");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const result = await analyzeWithGemini(INPUT);

    expect(result).toBeNull();
  });

  it("returns null, not a throw, on a non-2xx response", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_MODEL", "gemini-flash-latest");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    const result = await analyzeWithGemini(INPUT);

    expect(result).toBeNull();
  });

  it("returns null, not a hang, when the request times out", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_MODEL", "gemini-flash-latest");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("The operation timed out", "TimeoutError")),
    );

    const result = await analyzeWithGemini(INPUT);

    expect(result).toBeNull();
  });

  it("bounds each attempt with a request timeout, not an unbounded wait", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_MODEL", "gemini-flash-latest");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(geminiResponse(JSON.stringify(VALID_VERDICT)));
    vi.stubGlobal("fetch", fetchMock);

    await analyzeWithGemini(INPUT);

    const [, init] = fetchMock.mock.calls[0];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("falls back to the Flash-Lite model on a 429 from the main model, and succeeds", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_MODEL", "gemini-flash-latest");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValueOnce(geminiResponse(JSON.stringify(VALID_VERDICT)));
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzeWithGemini(INPUT);

    // one call for the exhausted primary model (no point retrying a 429
    // against the same model), one for the lite fallback — not more.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain("gemini-flash-latest");
    expect(String(fetchMock.mock.calls[1][0])).toContain("gemini-flash-lite-latest");
    expect(result?.verdict).toBe("likely_scam");
    expect(result?.source).toBe("gemini");
  });

  it("returns null when both the main model and the Flash-Lite fallback are rate-limited", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_MODEL", "gemini-flash-latest");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 429 }),
    );

    const result = await analyzeWithGemini(INPUT);

    expect(result).toBeNull();
  });

  it("gives the Flash-Lite fallback its own malformed-response retry", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_MODEL", "gemini-flash-latest");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429 }) // primary exhausted
      .mockResolvedValueOnce(geminiResponse("not valid json")) // lite attempt 1
      .mockResolvedValueOnce(geminiResponse(JSON.stringify(VALID_VERDICT))); // lite attempt 2
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzeWithGemini(INPUT);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result?.verdict).toBe("likely_scam");
  });

  it("does NOT try the Flash-Lite fallback for a non-quota failure on the main model", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_MODEL", "gemini-flash-latest");
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzeWithGemini(INPUT);

    // 2 attempts against the primary model only (its own malformed-retry
    // allowance) — a plain server error isn't what the Flash-Lite
    // fallback exists for, so it should never be called.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetchMock.mock.calls.forEach((call) => {
      expect(String(call[0])).toContain("gemini-flash-latest");
    });
    expect(result).toBeNull();
  });

  it("does NOT try the Flash-Lite fallback when the main model just returns malformed JSON twice", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_MODEL", "gemini-flash-latest");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(geminiResponse("not valid json"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzeWithGemini(INPUT);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetchMock.mock.calls.forEach((call) => {
      expect(String(call[0])).toContain("gemini-flash-latest");
    });
    expect(result).toBeNull();
  });

  it("never sends the API key anywhere but the request URL's query string", async () => {
    vi.stubEnv("GEMINI_API_KEY", "super-secret-key");
    vi.stubEnv("GEMINI_MODEL", "gemini-flash-latest");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(geminiResponse(JSON.stringify(VALID_VERDICT)));
    vi.stubGlobal("fetch", fetchMock);

    await analyzeWithGemini(INPUT);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("key=super-secret-key");
    expect(init.body).not.toContain("super-secret-key");
  });
});
