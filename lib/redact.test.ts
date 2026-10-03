import { describe, expect, it } from "vitest";
import { redact } from "./redact";

// Independent Luhn reference used only to build valid test fixtures — not
// imported from lib/redact.ts, so it isn't testing the implementation
// against itself.
function appendLuhnCheckDigit(base: string): string {
  let sum = 0;
  let double = true; // the digit we're about to append is position 1 (undoubled),
  // so the rightmost digit of `base` is doubled.
  for (let i = base.length - 1; i >= 0; i--) {
    let d = base.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  const check = (10 - (sum % 10)) % 10;
  return base + check;
}

const totalHiddenTags = (clean: string) =>
  (clean.match(/HIDDEN\]/g) ?? []).length;

describe("redact", () => {
  it("hides a CURP", () => {
    const { clean, found } = redact("Mi CURP es GORA800101HDFRRN09, guárdalo.");
    expect(clean).toContain("[CURP HIDDEN]");
    expect(clean).not.toContain("GORA800101HDFRRN09");
    expect(found).toEqual([{ type: "CURP", count: 1 }]);
  });

  it("hides an RFC (persona física, 13 chars)", () => {
    const { clean, found } = redact("Mi RFC: VACE850101AB1 para la factura.");
    expect(clean).toContain("[RFC HIDDEN]");
    expect(clean).not.toContain("VACE850101AB1");
    expect(found).toEqual([{ type: "RFC", count: 1 }]);
  });

  it("hides an RFC (persona moral, 12 chars)", () => {
    const { clean, found } = redact("Factura a nombre de ABC850101XY2 por favor.");
    expect(clean).toContain("[RFC HIDDEN]");
    expect(found).toEqual([{ type: "RFC", count: 1 }]);
  });

  it("hides a CLABE (exactly 18 digits)", () => {
    const { clean, found } = redact("Deposita a la CLABE 123456789012345678 hoy mismo.");
    expect(clean).toContain("[CLABE HIDDEN]");
    expect(clean).not.toContain("123456789012345678");
    expect(found).toEqual([{ type: "CLABE", count: 1 }]);
  });

  it("hides a Luhn-valid 16-digit card number", () => {
    const { clean, found } = redact("Mi tarjeta es 4111111111111111, cóbrala ahí.");
    expect(clean).toContain("[CARD HIDDEN]");
    expect(clean).not.toContain("4111111111111111");
    expect(found).toEqual([{ type: "CARD", count: 1 }]);
  });

  it("hides a Luhn-valid card number written with spaces", () => {
    const { clean, found } = redact("Tarjeta: 4111 1111 1111 1111 por favor.");
    expect(clean).toContain("[CARD HIDDEN]");
    expect(found).toEqual([{ type: "CARD", count: 1 }]);
  });

  it("does NOT hide a non-Luhn 16-digit number as a card", () => {
    const { clean, found } = redact("Número de referencia 4111111111111112 nada más.");
    expect(clean).toContain("4111111111111112");
    expect(clean).not.toContain("[CARD HIDDEN]");
    expect(found).toEqual([]);
  });

  it("hides a Luhn-valid 19-digit card without mistaking it for a CLABE", () => {
    const nineteen = appendLuhnCheckDigit("401288888888888888"); // 18-digit base + 1 check digit = 19
    expect(nineteen).toHaveLength(19);
    const { clean, found } = redact(`Tarjeta larga: ${nineteen} gracias.`);
    expect(clean).toContain("[CARD HIDDEN]");
    expect(clean).not.toContain("[CLABE HIDDEN]");
    expect(found).toEqual([{ type: "CARD", count: 1 }]);
  });

  it("hides a bare 10-digit Mexican phone number", () => {
    const { clean, found } = redact("Llámame al 5512345678 cuando puedas.");
    expect(clean).toContain("[PHONE HIDDEN]");
    expect(clean).not.toContain("5512345678");
    expect(found).toEqual([{ type: "PHONE", count: 1 }]);
  });

  it("hides a phone number with +52 and grouping", () => {
    const { clean, found } = redact("Contáctame: +52 55 1234 5678 gracias.");
    expect(clean).toContain("[PHONE HIDDEN]");
    expect(found).toEqual([{ type: "PHONE", count: 1 }]);
  });

  it("hides an email address", () => {
    const { clean, found } = redact("Responde a contacto@empresa.com.mx hoy.");
    expect(clean).toContain("[EMAIL HIDDEN]");
    expect(clean).not.toContain("contacto@empresa.com.mx");
    expect(found).toEqual([{ type: "EMAIL", count: 1 }]);
  });

  it("hides the value after 'contraseña', keeping the keyword", () => {
    const { clean, found } = redact("Mi contraseña es Elefante123, no la compartas.");
    expect(clean).toContain("contraseña");
    expect(clean).toContain("[SECRET HIDDEN]");
    expect(clean).not.toContain("Elefante123");
    expect(found).toEqual([{ type: "SECRET", count: 1 }]);
  });

  it("hides the value after 'NIP' and after 'código' (accented)", () => {
    const { clean, found } = redact("Tu NIP: 4521 y tu código es 9981.");
    expect(clean).not.toContain("4521");
    expect(clean).not.toContain("9981");
    expect(found).toEqual([{ type: "SECRET", count: 2 }]);
  });

  it("hides the value after 'codigo' (unaccented)", () => {
    const { clean, found } = redact("Usa el codigo 7788 para entrar.");
    expect(clean).not.toContain("7788");
    expect(found).toEqual([{ type: "SECRET", count: 1 }]);
  });

  it("does NOT redact an order number that looks like a short digit string", () => {
    const { clean, found } = redact("Tu Pedido 4521 está listo para recoger.");
    expect(clean).toBe("Tu Pedido 4521 está listo para recoger.");
    expect(found).toEqual([]);
  });

  it("leaves a harmless message completely untouched", () => {
    const text = "Su pedido está listo, pase el viernes.";
    const { clean, found } = redact(text);
    expect(clean).toBe(text);
    expect(found).toEqual([]);
  });

  it("keeps URLs fully intact, even ones containing long digit runs", () => {
    const text =
      "Revisa tu pedido aquí: http://ejemplo.com/pago?id=12345678901234567890 gracias.";
    const { clean, found } = redact(text);
    expect(clean).toBe(text);
    expect(found).toEqual([]);
  });

  it("redacts four different private details and reports a matching count", () => {
    const text =
      "CURP GORA800101HDFRRN09, RFC VACE850101AB1, CLABE 123456789012345678, tarjeta 4111111111111111.";
    const { clean, found } = redact(text);
    const totalFound = found.reduce((sum, f) => sum + f.count, 0);
    expect(totalFound).toBe(4);
    expect(totalHiddenTags(clean)).toBe(totalFound);
    expect(found.map((f) => f.type)).toEqual(["CURP", "RFC", "CARD", "CLABE"]);
  });

  it("always reports a tag count equal to the number of [...] HIDDEN] tags shown", () => {
    const text =
      "Habla al 5512345678 o escribe a persona@dominio.com, mi NIP es 1234.";
    const { clean, found } = redact(text);
    const totalFound = found.reduce((sum, f) => sum + f.count, 0);
    expect(totalHiddenTags(clean)).toBe(totalFound);
    expect(totalFound).toBe(3);
  });
});
