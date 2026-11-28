import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import {
  decodeCsvBuffer,
  generateBillsCsvTemplate,
  generateIncomesCsvTemplate,
  normalizeDateToBR,
  parseAndValidateBillsCsv,
  parseAndValidateBillsMatrix,
  parseAndValidateIncomesCsv,
  workbookBufferToMatrix,
} from "./csvParser";

// Conteúdo fiel ao arquivo file_example/modelo-despesas.csv (incluindo NBSP \u00A0, R$ sem espaço, ponto decimal e status "paga"/"Pago")
const SAMPLE_MODELO_DESPESAS_CSV = [
  "descricao;empresa;categoria;valor;vencimento;tipo_pagamento;status;banco",
  "Internet fibra;Vivo;Fixa;100;26/11/2026;pix;paga;",
  "Internet fibra;Vivo;Variável;40;26/10/2026;pix;paga;",
  "Gás encanado;Ultragaz;Variável;R$\u00A021,22;10/12/2026;debito;Pago;",
  "Gás encanado;Ultragaz;Variável;\u00A050,24;10/01/2027;debito;pendente;",
  "Água;Cacege;Variável;R$169.27;07/12/2026;debito;pendente;",
  "Água;Cacege;Variável;R$234.83;31/10/2026;debito;pendente;",
  "Luz;Enel;Variável;188.56;01/12/2026;debito;pendente;",
  "Luz;Enel;Variável;240,76;01/12/2026;debito;pendente;",
].join("\r\n");

const categories = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    user_id: "u1",
    name: "Fixa",
    is_default: true,
    created_at: "2026-11-27T00:00:00Z",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    user_id: "u1",
    name: "Variável",
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

describe("csvParser & spreadsheet import v2 (006 & 010)", () => {
  it("modelo CSV de despesas inclui opções de tipo_pagamento, status e categoria e passa sem erros", () => {
    const template = generateBillsCsvTemplate(categories);
    expect(template).toContain("tipo_pagamento: pix | credito | debito");
    expect(template).toContain("status: pendente | pago");
    expect(template).toContain("categoria: Fixa | Variável");
    expect(template).toContain("mes_referencia");

    const res = parseAndValidateBillsCsv(template, { categories });
    expect(res.invalidRows).toHaveLength(0);
    expect(res.validRows).toHaveLength(1);
    expect(res.validRows[0]?.amount_cents).toBe(12050);
    expect(res.validRows[0]?.due_date).toBe("2026-12-10");
    expect(res.validRows[0]?.reference_month).toBe("2026-12-01");
  });

  it("modelo CSV de rendas passa pelo parser sem erros e gera centavos inteiros", () => {
    const template = generateIncomesCsvTemplate(incomeTypes);
    const res = parseAndValidateIncomesCsv(template, { incomeTypes });
    expect(res.invalidRows).toHaveLength(0);
    expect(res.validRows).toHaveLength(1);
    expect(res.validRows[0]?.amount_cents).toBe(500000);
    expect(res.validRows[0]?.nature).toBe("fixed");
  });

  it("higieniza e valida o arquivo de exemplo real file_example/modelo-despesas.csv (incluindo Windows-1252)", () => {
    // Valida decodificação Windows-1252 (ex.: "Variável" = 0xE1, NBSP = 0xA0)
    const win1252Bytes = new Uint8Array([0x56, 0x61, 0x72, 0x69, 0xe1, 0x76, 0x65, 0x6c, 0x3b, 0xa0, 0x35, 0x30]);
    expect(decodeCsvBuffer(win1252Bytes.buffer)).toBe("Variável;\u00A050");

    const res = parseAndValidateBillsCsv(SAMPLE_MODELO_DESPESAS_CSV, { categories });
    expect(res.rows).toHaveLength(8);

    // Linhas 2 e 3: pix + status "paga" + valores inteiros ("100", "40")
    expect(res.rows[0]?.isValid).toBe(true);
    expect(res.rows[0]?.cells.valor).toBe("100,00");
    expect(res.rows[0]?.cells.status).toBe("Pago");
    expect(res.rows[0]?.cells.mes_referencia).toBe("11/2026");
    expect(res.rows[0]?.parsedData?.amount_cents).toBe(10000);
    expect(res.rows[0]?.parsedData?.status).toBe("paid");

    expect(res.rows[1]?.isValid).toBe(true);
    expect(res.rows[1]?.cells.valor).toBe("40,00");
    expect(res.rows[1]?.cells.status).toBe("Pago");
    expect(res.rows[1]?.cells.mes_referencia).toBe("10/2026");

    // Linha 4: "R$\u00A021,22" + "Pago" + debito sem banco -> valor higienizado, erro na célula banco
    expect(res.rows[2]?.cells.valor).toBe("21,22");
    expect(res.rows[2]?.cells.status).toBe("Pago");
    expect(res.rows[2]?.isValid).toBe(false);
    expect(res.rows[2]?.fieldErrors.banco).toMatch(/banco cadastrado/i);

    // Linha 5: "\u00A050,24" -> "50,24"
    expect(res.rows[3]?.cells.valor).toBe("50,24");

    // Linhas 6-8: "R$169.27", "R$234.83", "188.56" -> higienizados para vírgula sem perder centavos
    expect(res.rows[4]?.cells.valor).toBe("169,27");
    expect(res.rows[5]?.cells.valor).toBe("234,83");
    expect(res.rows[6]?.cells.valor).toBe("188,56");
    expect(res.rows[7]?.cells.valor).toBe("240,76");

    expect(res.validRows).toHaveLength(2);
    expect(res.invalidRows).toHaveLength(6);
  });

  it("lê arquivos XLSX com data serial do Excel convertendo para dd/mm/yyyy", () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ["descricao", "empresa", "categoria", "valor", "vencimento", "tipo_pagamento", "status", "banco"],
      ["Aluguel", "Imob", "Fixa", "1500.50", 46366, "pix", "pendente", ""],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Despesas");
    const arr = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

    const matrix = workbookBufferToMatrix(arr);
    const res = parseAndValidateBillsMatrix(matrix, { categories });
    expect(res.validRows).toHaveLength(1);
    expect(res.rows[0]?.cells.valor).toBe("1500,50");
    expect(res.rows[0]?.cells.vencimento).toBe("10/12/2026");
    expect(res.validRows[0]?.due_date).toBe("2026-12-10");
  });

  it("normaliza datas seriais do Excel e formatos ISO/BR para dd/mm/yyyy", () => {
    expect(normalizeDateToBR("2026-12-05")).toEqual({ display: "05/12/2026", iso: "2026-12-05" });
    expect(normalizeDateToBR("5/12/2026")).toEqual({ display: "05/12/2026", iso: "2026-12-05" });
    expect(normalizeDateToBR(46366)).toEqual({ display: "10/12/2026", iso: "2026-12-10" });
  });

  it("reporta erros por célula quando categoria ou valor são inválidos", () => {
    const csv =
      "descricao;empresa;categoria;valor;vencimento;tipo_pagamento;status;banco\nTeste;;Inexistente;0;10/12/2026;pix;pendente;";
    const res = parseAndValidateBillsCsv(csv, { categories });
    expect(res.validRows).toHaveLength(0);
    expect(res.invalidRows).toHaveLength(1);
    expect(res.rows[0]?.fieldErrors.categoria).toMatch(/não encontrada/i);
    expect(res.rows[0]?.fieldErrors.valor).toMatch(/inválido/i);
  });
});
