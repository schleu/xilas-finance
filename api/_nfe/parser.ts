import type {
  BillItemCategory,
  BillItemUnit,
} from "../../src/features/bills/schemas/billItemSchema.js";
import { classifySupermarketItem } from "./classifyItem.js";

export interface ParsedNfeItem {
  description: string;
  item_category: BillItemCategory;
  quantity: number;
  unit: BillItemUnit;
  unit_price_cents: number;
  total_cents: number;
}

export interface ParsedNfeResult {
  uf: "CE" | "BA";
  marketName: string | null;
  issuedDate: string | null;
  totalCents: number | null;
  items: ParsedNfeItem[];
}

export class NfeParseError extends Error {
  readonly code: "INVALID_URL" | "CAPTCHA_REQUIRED" | "FETCH_FAILED" | "UNSUPPORTED_FORMAT";
  readonly statusCode: number;

  constructor(
    code: "INVALID_URL" | "CAPTCHA_REQUIRED" | "FETCH_FAILED" | "UNSUPPORTED_FORMAT",
    message: string,
    statusCode = 422,
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

const ALLOWED_HOST_SUFFIXES: ReadonlyArray<{ suffix: string; uf: "CE" | "BA" }> = [
  { suffix: ".sefaz.ce.gov.br", uf: "CE" },
  { suffix: ".sefaz.ba.gov.br", uf: "BA" },
];

export function validateAndDetectSefazUrl(rawUrl: string): { url: URL; uf: "CE" | "BA" } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new NfeParseError("INVALID_URL", "URL da NF-e/NFC-e inválida.", 400);
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new NfeParseError("INVALID_URL", "Protocolo de URL não permitido.", 400);
  }

  const host = parsed.hostname.toLowerCase();
  for (const allowed of ALLOWED_HOST_SUFFIXES) {
    if (host.endsWith(allowed.suffix) || host === allowed.suffix.slice(1)) {
      return { url: parsed, uf: allowed.uf };
    }
  }

  throw new NfeParseError(
    "INVALID_URL",
    "Domínio não suportado. Informe um link oficial da SEFAZ-CE ou SEFAZ-BA.",
    400,
  );
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parseBrDecimalToCents(raw: string): number | null {
  const cleaned = raw.replace(/R\$/gi, "").replace(/\s+/g, "").trim();
  if (!cleaned) return null;
  const match = /^(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const intPart = Number(match[1]!.replace(/\./g, ""));
  const decPart = Number((match[2] ?? "00").padEnd(2, "0").slice(0, 2));
  const total = intPart * 100 + decPart;
  return Number.isSafeInteger(total) && total > 0 ? total : null;
}

function parseBrQuantity(raw: string): number {
  const cleaned = raw.replace(/\./g, "").replace(",", ".").trim();
  const num = Number(cleaned);
  return Number.isFinite(num) && num > 0 ? num : 1;
}

function normalizeUnit(raw: string): BillItemUnit {
  const u = raw.trim().toLowerCase();
  if (u === "kg" || u === "kilo" || u === "quilo") return "kg";
  if (u === "g" || u === "gr") return "g";
  if (u === "l" || u === "lt" || u === "litro") return "l";
  if (u === "ml") return "ml";
  if (u === "pct" || u === "pc" || u === "cx") return "pct";
  return "un";
}

function extractDateFromHtml(text: string): string | null {
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(text);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function parseSefazHtml(html: string, uf: "CE" | "BA"): ParsedNfeResult {
  if (/g-recaptcha|h-captcha|cf-turnstile|recaptcha\/api\.js/i.test(html)) {
    throw new NfeParseError(
      "CAPTCHA_REQUIRED",
      "A SEFAZ solicitou verificação humana (CAPTCHA). O link foi mantido para você cadastrar os itens manualmente.",
      422,
    );
  }

  // Market name (standard SEFAZ NFC-e markup: #u20 / .txtTopo)
  const marketMatch =
    /<div[^>]*class=["'][^"']*txtTopo[^"']*["'][^>]*>([\s\S]*?)<\/div>/i.exec(html) ??
    /<div[^>]*id=["']u20["'][^>]*>([\s\S]*?)<\/div>/i.exec(html);
  const marketName = marketMatch ? stripTags(marketMatch[1]!) || null : null;

  const plainText = stripTags(html);
  const issuedDate = extractDateFromHtml(plainText);

  // Total value (standard SEFAZ NFC-e markup: .totalNumb.txtMax or "Valor a pagar R$:")
  const totalMatch =
    /<span[^>]*class=["'][^"']*totalNumb[^"']*txtMax[^"']*["'][^>]*>([\s\S]*?)<\/span>/i.exec(html) ??
    /Valor\s+a\s+pagar\s*R?\$?:?\s*([0-9.,]+)/i.exec(plainText);
  const totalCents = totalMatch ? parseBrDecimalToCents(stripTags(totalMatch[1]!)) : null;

  // Line items (standard SEFAZ NFC-e rows <tr id="Item + ...">)
  const items: ParsedNfeItem[] = [];
  const rowRegex = /<tr[^>]*id=["']Item[^"']*["'][^>]*>([\s\S]*?)<\/tr>/gi;
  for (const rowMatch of html.matchAll(rowRegex)) {
    const rowHtml = rowMatch[1]!;
    const descMatch = /<span[^>]*class=["'][^"']*txtTit[^"']*["'][^>]*>([\s\S]*?)<\/span>/i.exec(rowHtml);
    const qtyMatch = /<span[^>]*class=["'][^"']*Rqtd[^"']*["'][^>]*>([\s\S]*?)<\/span>/i.exec(rowHtml);
    const unitMatch = /<span[^>]*class=["'][^"']*RUN[^"']*["'][^>]*>([\s\S]*?)<\/span>/i.exec(rowHtml);
    const unitPriceMatch = /<span[^>]*class=["'][^"']*RvlUnit[^"']*["'][^>]*>([\s\S]*?)<\/span>/i.exec(rowHtml);
    const totalItemMatch = /<span[^>]*class=["'][^"']*valor[^"']*["'][^>]*>([\s\S]*?)<\/span>/i.exec(rowHtml);

    const description = descMatch ? stripTags(descMatch[1]!).slice(0, 160) : "";
    if (!description) continue;

    const qtyRaw = qtyMatch ? stripTags(qtyMatch[1]!).replace(/^Qtde\.?:\s*/i, "") : "1";
    const unitRaw = unitMatch ? stripTags(unitMatch[1]!).replace(/^UN:\s*/i, "") : "un";
    const unitPriceRaw = unitPriceMatch
      ? stripTags(unitPriceMatch[1]!).replace(/^Vl\.?\s*Unit\.?:?\s*/i, "")
      : "";
    const totalItemRaw = totalItemMatch ? stripTags(totalItemMatch[1]!) : "";

    const quantity = parseBrQuantity(qtyRaw);
    const unit = normalizeUnit(unitRaw);
    const totalItemCents = parseBrDecimalToCents(totalItemRaw);
    const unitPriceCents =
      parseBrDecimalToCents(unitPriceRaw) ??
      (totalItemCents ? Math.max(1, Math.round(totalItemCents / quantity)) : null);

    if (!totalItemCents || !unitPriceCents) continue;

    items.push({
      description,
      item_category: classifySupermarketItem(description),
      quantity,
      unit,
      unit_price_cents: unitPriceCents,
      total_cents: totalItemCents,
    });
  }

  if (!marketName && items.length === 0 && !totalCents) {
    throw new NfeParseError(
      "UNSUPPORTED_FORMAT",
      "Não foi possível reconhecer os itens nesta página da SEFAZ. Você pode cadastrar manualmente.",
      422,
    );
  }

  return { uf, marketName, issuedDate, totalCents, items };
}
