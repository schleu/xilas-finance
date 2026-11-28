import { describe, expect, it } from "vitest";
import {
  generateBillsCsvTemplate,
  generateIncomesCsvTemplate,
  parseAndValidateBillsCsv,
  parseAndValidateIncomesCsv,
} from "./csvParser";

const categories = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    user_id: "u1",
    name: "Fixa",
    is_default: true,
    created_at: "2026-11-27T00:00:00Z",
  },
];

const incomeTypes = [
  {
    id: "22222222-2222-4222-8222-222222222222",
    user_id: "u1",
    name: "Salário",
    is_default: true,
    created_at: "2026-11-27T00:00:00Z",
  },
];

describe("csvParser (006 / T-01, T-02)", () => {
  it("modelo CSV de despesas passa pelo parser sem erros e gera centavos inteiros", () => {
    const template = generateBillsCsvTemplate();
    const res = parseAndValidateBillsCsv(template, { categories });
    expect(res.invalidRows).toHaveLength(0);
    expect(res.validRows).toHaveLength(1);
    expect(res.validRows[0]?.amount_cents).toBe(12050);
    expect(res.validRows[0]?.due_date).toBe("2026-12-10");
  });

  it("modelo CSV de rendas passa pelo parser sem erros e gera centavos inteiros", () => {
    const template = generateIncomesCsvTemplate();
    const res = parseAndValidateIncomesCsv(template, { incomeTypes });
    expect(res.invalidRows).toHaveLength(0);
    expect(res.validRows).toHaveLength(1);
    expect(res.validRows[0]?.amount_cents).toBe(500000);
    expect(res.validRows[0]?.nature).toBe("fixed");
  });

  it("reporta erros por linha quando categoria ou valor são inválidos", () => {
    const csv = "descricao;empresa;categoria;valor;vencimento;tipo_pagamento;status;banco\nTeste;;Inexistente;0;10/12/2026;pix;pendente;";
    const res = parseAndValidateBillsCsv(csv, { categories });
    expect(res.validRows).toHaveLength(0);
    expect(res.invalidRows).toHaveLength(1);
    expect(res.invalidRows[0]?.lineNumber).toBe(2);
  });
});
