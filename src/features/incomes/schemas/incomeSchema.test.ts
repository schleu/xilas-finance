import { describe, expect, it } from "vitest";
import { incomeSchema, incomeTypeSchema } from "./incomeSchema";

describe("incomeSchema (005 / T-02)", () => {
  it("valida renda válida com valor em centavos inteiros", () => {
    const parsed = incomeSchema.parse({
      description: "Salário mensal",
      amount_cents: 500000,
      received_date: "2026-11-05",
      nature: "fixed",
      income_type_id: "11111111-1111-4111-8111-111111111111",
      bank_id: null,
    });
    expect(parsed.amount_cents).toBe(500000);
    expect(parsed.nature).toBe("fixed");
  });

  it("rejeita valor zero, negativo ou decimal (float)", () => {
    for (const bad of [0, -100, 12.5]) {
      const res = incomeSchema.safeParse({
        description: "Freela",
        amount_cents: bad,
        received_date: "2026-11-05",
        nature: "variable",
        income_type_id: "11111111-1111-4111-8111-111111111111",
      });
      expect(res.success).toBe(false);
    }
  });

  it("valida nome de tipo de renda", () => {
    expect(incomeTypeSchema.safeParse({ name: "Dividendos" }).success).toBe(true);
    expect(incomeTypeSchema.safeParse({ name: "  " }).success).toBe(false);
  });
});
