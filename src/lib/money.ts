/** Dinheiro é sempre inteiro em centavos (constituição, princípio 2). */

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBRL(cents: number): string {
  if (!Number.isInteger(cents)) throw new Error("formatBRL espera centavos inteiros");
  return brl.format(cents / 100);
}

/** Formata centavos inteiros para exibição editável em pt-BR (ex.: 12050 -> "120,50"). */
export function centsToBRInput(cents: number): string {
  if (!Number.isInteger(cents)) throw new Error("centsToBRInput espera centavos inteiros");
  const intPart = Math.trunc(cents / 100);
  const decPart = String(Math.abs(cents % 100)).padStart(2, "0");
  return `${intPart},${decPart}`;
}

/**
 * Converte ponto decimal em vírgula quando representa centavos (1 ou 2 dígitos finais)
 * sem quebrar separadores de milhar (ex.: "1.200" ou "1.200,50").
 */
export function normalizeDecimalInput(input: string): string {
  const cleaned = input.replace(/[\u00A0\u200B-\u200D\uFEFF]/g, " ").trim();
  if (!cleaned || cleaned.includes(",")) return cleaned;
  const match = /^((?:R\$\s*)?[\d.]+)\.(\d{1,2})$/.exec(cleaned);
  if (!match) return cleaned;
  return `${match[1]},${match[2]}`;
}

/**
 * Converte texto digitado ("1.234,56", "12,5", "10", "R$169.27", "188.56") em centavos.
 * Retorna null se o texto não for um valor monetário válido.
 */
export function parseBRLToCents(input: string): number | null {
  const cleaned = input
    .replace(/[\u00A0\u200B-\u200D\uFEFF]/g, " ")
    .trim()
    .replace(/^R\$\s*/i, "")
    .trim();

  if (!cleaned) return null;

  let normalized: string;
  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  if (hasComma && hasDot) {
    // Decide decimal separator by whichever appears last
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");
    if (lastDot > lastComma) {
      // US format: 1,234.56
      normalized = cleaned.replace(/,/g, "");
    } else {
      // BR format: 1.234,56
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    }
  } else if (hasComma) {
    normalized = cleaned.replace(",", ".");
  } else if (hasDot) {
    // Dot with 1-2 trailing digits is decimal cents (e.g. "169.27", "12.5", "1.234.56")
    const dotCentsMatch = /^([\d.]+)\.(\d{1,2})$/.exec(cleaned);
    if (dotCentsMatch) {
      normalized = `${dotCentsMatch[1]!.replace(/\./g, "")}.${dotCentsMatch[2]}`;
    } else {
      // Dot as thousands separator (e.g. "1.200")
      normalized = cleaned.replace(/\./g, "");
    }
  } else {
    normalized = cleaned;
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [intPart = "0", decimals = ""] = normalized.split(".");
  return Number(intPart) * 100 + Number(decimals.padEnd(2, "0"));
}
