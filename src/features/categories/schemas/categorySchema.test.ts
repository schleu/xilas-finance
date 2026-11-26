import { describe, expect, it } from "vitest";
import { categorySchema } from "./categorySchema";

describe("categorySchema", () => {
  it("aceita nome válido e remove espaços nas pontas", () => {
    const result = categorySchema.safeParse({ name: "  Lazer  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Lazer");
    }
  });

  it("rejeita nome vazio ou só espaços", () => {
    expect(categorySchema.safeParse({ name: "" }).success).toBe(false);
    expect(categorySchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("rejeita nome acima de 60 caracteres", () => {
    expect(categorySchema.safeParse({ name: "a".repeat(61) }).success).toBe(false);
  });
});
