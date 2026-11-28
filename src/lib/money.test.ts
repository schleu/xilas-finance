import { describe, expect, it } from "vitest";
import { centsToBRInput, formatBRL, normalizeDecimalInput, parseBRLToCents } from "./money";

const nbsp = (s: string) => s.replace(/\u00a0/g, " ");

describe("formatBRL", () => {
  it("formata centavos em reais", () => {
    expect(nbsp(formatBRL(123456))).toBe("R$ 1.234,56");
    expect(nbsp(formatBRL(5))).toBe("R$ 0,05");
  });
  it("rejeita valores não inteiros", () => {
    expect(() => formatBRL(10.5)).toThrow();
  });
});

describe("centsToBRInput", () => {
  it("formata centavos em texto editável pt-BR", () => {
    expect(centsToBRInput(12050)).toBe("120,50");
    expect(centsToBRInput(5)).toBe("0,05");
  });
});

describe("normalizeDecimalInput", () => {
  it("converte ponto decimal em vírgula para centavos", () => {
    expect(normalizeDecimalInput("120.50")).toBe("120,50");
    expect(normalizeDecimalInput("120.5")).toBe("120,5");
    expect(normalizeDecimalInput("1.234.56")).toBe("1.234,56");
    expect(normalizeDecimalInput("R$169.27")).toBe("R$169,27");
  });

  it("preserva separador de milhar e vírgula existente", () => {
    expect(normalizeDecimalInput("1.200")).toBe("1.200");
    expect(normalizeDecimalInput("1.200,50")).toBe("1.200,50");
    expect(normalizeDecimalInput("50,24")).toBe("50,24");
  });
});

describe("parseBRLToCents", () => {
  it("converte formatos comuns e formatos mistos de planilhas", () => {
    expect(parseBRLToCents("1.234,56")).toBe(123456);
    expect(parseBRLToCents("1,234.56")).toBe(123456);
    expect(parseBRLToCents("12,5")).toBe(1250);
    expect(parseBRLToCents("10")).toBe(1000);
    expect(parseBRLToCents("100")).toBe(10000);
    expect(parseBRLToCents("R$ 0,05")).toBe(5);
    expect(parseBRLToCents("R$\u00a021,22")).toBe(2122);
    expect(parseBRLToCents("\u00a050,24")).toBe(5024);
    expect(parseBRLToCents("R$169.27")).toBe(16927);
    expect(parseBRLToCents("188.56")).toBe(18856);
    expect(parseBRLToCents("1.200")).toBe(120000);
  });
  it("evita erro de ponto flutuante", () => {
    expect(parseBRLToCents("0,29")).toBe(29);
    expect(parseBRLToCents("19,99")).toBe(1999);
  });
  it("retorna null para entradas inválidas", () => {
    expect(parseBRLToCents("abc")).toBeNull();
    expect(parseBRLToCents("1,234")).toBeNull();
    expect(parseBRLToCents("")).toBeNull();
  });
});
