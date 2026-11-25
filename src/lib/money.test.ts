import { describe, expect, it } from "vitest";
import { formatBRL, parseBRLToCents } from "./money";

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

describe("parseBRLToCents", () => {
  it("converte formatos comuns", () => {
    expect(parseBRLToCents("1.234,56")).toBe(123456);
    expect(parseBRLToCents("12,5")).toBe(1250);
    expect(parseBRLToCents("10")).toBe(1000);
    expect(parseBRLToCents("R$ 0,05")).toBe(5);
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
