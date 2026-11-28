import { describe, expect, it } from "vitest";
import { billSchema, isBillOverdue, maskBankCode } from "./billSchema";

const validCategoryId = "11111111-1111-4111-8111-111111111111";

describe("billSchema (T-09 / US-2)", () => {
  it("aceita conta pix válida e limpa campos bancários caso enviados", () => {
    const result = billSchema.safeParse({
      description: "  Internet fibra  ",
      company: "  Provedor X  ",
      category_id: validCategoryId,
      amount_cents: 12050,
      payment_type: "pix",
      bank: "Banco X",
      agency: "0001",
      account_number: "12345-6",
      due_date: "2026-12-10",
      status: "pending",
      paid_at: null,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        description: "Internet fibra",
        company: "Provedor X",
        category_id: validCategoryId,
        amount_cents: 12050,
        payment_type: "pix",
        bank: null,
        agency: null,
        account_number: null,
        due_date: "2026-12-10",
        reference_month: "2026-12-01",
        status: "pending",
        paid_at: null,
      });
    }
  });

  it("aceita conta em débito com banco, agência e conta preenchidos", () => {
    const result = billSchema.safeParse({
      description: "Energia",
      company: "",
      category_id: validCategoryId,
      amount_cents: 25000,
      payment_type: "debit",
      bank: "Banco do Brasil",
      agency: "1234",
      account_number: "56789-0",
      due_date: "2026-12-15",
      status: "paid",
      paid_at: "2026-12-14",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.company).toBeNull();
      expect(result.data.bank).toBe("Banco do Brasil");
      expect(result.data.agency).toBe("1234");
      expect(result.data.account_number).toBe("56789-0");
    }
  });

  it("exige banco, agência e conta quando tipo de pagamento é débito", () => {
    const result = billSchema.safeParse({
      description: "Energia",
      category_id: validCategoryId,
      amount_cents: 25000,
      payment_type: "debit",
      bank: "",
      agency: "   ",
      account_number: "",
      due_date: "2026-12-15",
      status: "pending",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path[0]);
      expect(paths).toContain("bank");
      expect(paths).toContain("agency");
      expect(paths).toContain("account_number");
    }
  });

  it("rejeita valor menor ou igual a zero ou float", () => {
    for (const amount of [0, -100, 10.5]) {
      const result = billSchema.safeParse({
        description: "Conta",
        category_id: validCategoryId,
        amount_cents: amount,
        payment_type: "credit",
        due_date: "2026-12-15",
        status: "pending",
      });
      expect(result.success).toBe(false);
    }
  });

  it("rejeita descrição vazia ou maior que 120 caracteres", () => {
    expect(
      billSchema.safeParse({
        description: "   ",
        category_id: validCategoryId,
        amount_cents: 1000,
        payment_type: "pix",
        due_date: "2026-12-15",
        status: "pending",
      }).success,
    ).toBe(false);

    expect(
      billSchema.safeParse({
        description: "a".repeat(121),
        category_id: validCategoryId,
        amount_cents: 1000,
        payment_type: "pix",
        due_date: "2026-12-15",
        status: "pending",
      }).success,
    ).toBe(false);
  });

  it("preserva reference_month quando informado explicitamente e normaliza para dia 01", () => {
    const result = billSchema.safeParse({
      description: "Fatura cartão",
      category_id: validCategoryId,
      amount_cents: 35000,
      payment_type: "credit",
      due_date: "2027-01-10",
      reference_month: "2026-12",
      status: "pending",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reference_month).toBe("2026-12-01");
    }
  });

  it("rejeita paid_at preenchido quando status é pending", () => {
    const result = billSchema.safeParse({
      description: "Conta",
      category_id: validCategoryId,
      amount_cents: 1000,
      payment_type: "pix",
      due_date: "2026-12-15",
      status: "pending",
      paid_at: "2026-11-26",
    });
    expect(result.success).toBe(false);
  });
});

describe("helpers de contas", () => {
  it("identifica corretamente lançamentos atrasados (derivado)", () => {
    expect(isBillOverdue({ status: "pending", due_date: "2026-11-25" }, "2026-11-26")).toBe(true);
    expect(isBillOverdue({ status: "pending", due_date: "2026-11-26" }, "2026-11-26")).toBe(false);
    expect(isBillOverdue({ status: "paid", due_date: "2026-11-20" }, "2026-11-26")).toBe(false);
  });

  it("mascara agência e conta mantendo apenas os últimos dígitos", () => {
    expect(maskBankCode("001234")).toBe("••••1234");
    expect(maskBankCode("56789-0")).toBe("••••89-0");
    expect(maskBankCode("1234")).toBe("••••");
    expect(maskBankCode("")).toBe("");
    expect(maskBankCode(null)).toBe("");
  });
});
