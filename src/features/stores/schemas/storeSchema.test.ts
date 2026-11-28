import { describe, expect, it } from "vitest";
import { storeSchema } from "./storeSchema";

describe("storeSchema (003 / T-04)", () => {
  it("valida loja online limpando subtipo", () => {
    const res = storeSchema.parse({
      name: "  Amazon  ",
      store_type: "online",
      store_subtype: "supermarket",
    });
    expect(res).toEqual({
      name: "Amazon",
      store_type: "online",
      store_subtype: null,
    });
  });

  it("valida supermercado físico mantendo subtipo", () => {
    const res = storeSchema.parse({
      name: "Assaí",
      store_type: "physical",
      store_subtype: "supermarket",
    });
    expect(res.store_subtype).toBe("supermarket");
  });

  it("rejeita nome vazio", () => {
    const res = storeSchema.safeParse({ name: "   ", store_type: "online" });
    expect(res.success).toBe(false);
  });
});
