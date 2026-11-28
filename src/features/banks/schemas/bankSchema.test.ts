import { describe, expect, it } from "vitest";
import { bankSchema } from "./bankSchema";

describe("bankSchema (003 / T-05)", () => {
  it("exige agência e conta quando has_debit_account = true", () => {
    const res = bankSchema.safeParse({
      name: "Nubank",
      has_debit_account: true,
      agency: "",
      account_number: "",
      has_credit_card: false,
    });
    expect(res.success).toBe(false);
  });

  it("exige dia de vencimento (1 a 31) quando has_credit_card = true", () => {
    const missing = bankSchema.safeParse({
      name: "Itaú",
      has_debit_account: false,
      has_credit_card: true,
      credit_card_due_day: null,
    });
    expect(missing.success).toBe(false);

    const valid = bankSchema.parse({
      name: "Itaú",
      has_debit_account: true,
      agency: "0001",
      account_number: "98765-4",
      has_credit_card: true,
      credit_card_label: "Itaú Platinum",
      credit_card_due_day: 15,
    });
    expect(valid.credit_card_due_day).toBe(15);
    expect(valid.agency).toBe("0001");
  });
});
