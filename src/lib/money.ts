/** Dinheiro é sempre inteiro em centavos (constituição, princípio 2). */

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBRL(cents: number): string {
  if (!Number.isInteger(cents)) throw new Error("formatBRL espera centavos inteiros");
  return brl.format(cents / 100);
}

/**
 * Converte texto digitado ("1.234,56", "12,5", "10") em centavos.
 * Retorna null se o texto não for um valor monetário válido.
 */
export function parseBRLToCents(input: string): number | null {
  const normalized = input
    .trim()
    .replace(/^R\$\s*/, "")
    .replace(/\./g, "")
    .replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [intPart = "0", decimals = ""] = normalized.split(".");
  return Number(intPart) * 100 + Number(decimals.padEnd(2, "0"));
}
