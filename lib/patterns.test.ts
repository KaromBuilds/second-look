import { describe, expect, it } from "vitest";
import { matchPattern } from "./patterns";

describe("matchPattern", () => {
  it("matches a 'supplier changed account' message to pattern 1", () => {
    const result = matchPattern(
      "Hola, soy tu proveedor, cambiamos de banco, deposita a esta cuenta el pago de tu pedido.",
    );
    expect(result?.pattern.id).toBe("supplier-account-change");
  });

  it("matches the same supplier scam written in English", () => {
    const result = matchPattern(
      "Hi, this is your supplier, we changed bank accounts. Please deposit to this account.",
    );
    expect(result?.pattern.id).toBe("supplier-account-change");
  });

  it("matches a fake SAT notice", () => {
    const result = matchPattern(
      "Tiene un adeudo fiscal pendiente en su buzon tributario del SAT, pague antes de 24 horas.",
    );
    expect(result?.pattern.id).toBe("fake-sat-notice");
  });

  it("matches a fake bank security alert", () => {
    const result = matchPattern(
      "Detectamos actividad sospechosa en tu cuenta, confirma tu codigo o tu cuenta sera bloqueada.",
    );
    expect(result?.pattern.id).toBe("bank-confirm-code");
  });

  it("matches a family emergency / new number scam", () => {
    const result = matchPattern(
      "Hola soy yo, cambie de numero, estoy en un problema y necesito dinero urgente, no le digas a nadie.",
    );
    expect(result?.pattern.id).toBe("family-emergency");
  });

  it("is accent-insensitive in both directions", () => {
    const withAccents = matchPattern("tiene un adeudo fiscal, revise su buzón tributario");
    const withoutAccents = matchPattern("tiene un adeudo fiscal, revise su buzon tributario");
    expect(withAccents?.pattern.id).toBe("fake-sat-notice");
    expect(withoutAccents?.pattern.id).toBe("fake-sat-notice");
  });

  it("is case-insensitive", () => {
    const result = matchPattern("CAMBIAMOS DE BANCO, DEPOSITA A ESTA CUENTA");
    expect(result?.pattern.id).toBe("supplier-account-change");
  });

  it("returns null for a harmless message with no pattern keywords", () => {
    const result = matchPattern("Su pedido está listo, pase el viernes.");
    expect(result).toBeNull();
  });

  it("returns a higher score for a message matching more keywords", () => {
    const strongMatch = matchPattern(
      "cambiamos de banco, cambio de cuenta, nueva cuenta bancaria, deposita a esta cuenta",
    );
    const weakMatch = matchPattern("cambiamos de banco");
    expect(strongMatch?.score).toBeGreaterThan(weakMatch?.score ?? 0);
  });

  it("every pattern is labeled as simulated data", () => {
    const result = matchPattern("cambiamos de banco, deposita a esta cuenta");
    expect(result?.pattern.simulated).toBe(true);
  });

  it("every pattern has exactly 3 safe steps", async () => {
    const patterns = (await import("../data/patterns.json")).default;
    for (const pattern of patterns) {
      expect(pattern.safe_steps).toHaveLength(3);
    }
  });

  it("has 8 patterns, each with a unique id", async () => {
    const patterns = (await import("../data/patterns.json")).default;
    expect(patterns).toHaveLength(8);
    const ids = new Set(patterns.map((p) => p.id));
    expect(ids.size).toBe(8);
  });
});
