import { describe, expect, it } from "vitest";
import { buildFallbackVerdict, shouldEscalate } from "./verdict";

describe("shouldEscalate", () => {
  it("escalates when confidence is below 60", () => {
    expect(shouldEscalate({ confidence: 59, dangerousLink: false })).toBe(true);
  });

  it("does not escalate at exactly 60 confidence with no other reason", () => {
    expect(shouldEscalate({ confidence: 60, dangerousLink: false })).toBe(false);
  });

  it("escalates when a dangerous link was found, regardless of confidence", () => {
    expect(shouldEscalate({ confidence: 95, dangerousLink: true })).toBe(true);
  });

  it("escalates when the model itself said to, regardless of confidence", () => {
    expect(
      shouldEscalate({ confidence: 95, dangerousLink: false, modelEscalate: true }),
    ).toBe(true);
  });

  it("does not escalate when nothing calls for it", () => {
    expect(shouldEscalate({ confidence: 90, dangerousLink: false })).toBe(false);
  });
});

describe("buildFallbackVerdict", () => {
  const pattern = {
    name: "Supplier bank account change",
    red_flags: ["Asks you to send payment to a new bank account"],
    safe_steps: ["Step one", "Step two", "Step three"],
  };

  it("labels the result as a basic, AI-unavailable check", () => {
    const result = buildFallbackVerdict({ pattern, dangerousLink: false });
    expect(result.source).toBe("basic");
    expect(result.explanation).toContain("Basic check");
  });

  it("uses the matched pattern's own name, red flags and steps", () => {
    const result = buildFallbackVerdict({ pattern, dangerousLink: false });
    expect(result.verdict).toBe("likely_scam");
    expect(result.scam_type).toBe(pattern.name);
    expect(result.red_flags).toEqual(pattern.red_flags);
    expect(result.steps).toEqual(pattern.safe_steps);
  });

  it("never claims looks_ok, even with no pattern match", () => {
    const result = buildFallbackVerdict({ pattern: null, dangerousLink: false });
    expect(result.verdict).not.toBe("looks_ok");
  });

  it("always escalates, since its own confidence is always below 60", () => {
    const withPattern = buildFallbackVerdict({ pattern, dangerousLink: false });
    const withoutPattern = buildFallbackVerdict({ pattern: null, dangerousLink: false });
    expect(withPattern.confidence).toBeLessThan(60);
    expect(withoutPattern.confidence).toBeLessThan(60);
    expect(withPattern.escalate).toBe(true);
    expect(withoutPattern.escalate).toBe(true);
  });

  it("always returns exactly 3 steps", () => {
    expect(buildFallbackVerdict({ pattern, dangerousLink: false }).steps).toHaveLength(3);
    expect(buildFallbackVerdict({ pattern: null, dangerousLink: true }).steps).toHaveLength(3);
  });
});
