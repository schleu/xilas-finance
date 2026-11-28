import type { Bank } from "@/features/banks/api/banksApi";
import { billSchema, type BillInput } from "@/features/bills/schemas/billSchema";
import type { Category } from "@/features/categories/api/categoriesApi";
import type { IncomeType } from "@/features/incomes/api/incomesApi";
import { incomeSchema, type IncomeInput } from "@/features/incomes/schemas/incomeSchema";
import type { Store } from "@/features/stores/api/storesApi";
import { parseBRLToCents } from "@/lib/money";

export const MAX_CSV_ROWS = 500;

export interface CsvInvalidRow {
  lineNumber: number;
  raw: string;
  errors: string[];
}

export interface CsvParseResult<T> {
  validRows: T[];
  invalidRows: CsvInvalidRow[];
}

export function generateBillsCsvTemplate(): string {
  const header = "descricao;empresa;categoria;valor;vencimento;tipo_pagamento;status;banco";
  const example = "Internet fibra;Vivo;Fixa;120,50;10/12/2026;pix;pendente;";
  return `\uFEFF${header}\n${example}\n`;
}

export function generateIncomesCsvTemplate(): string {
  const header = "descricao;valor;data;natureza;tipo_renda;banco";
  const example = "Salário mensal;5000,00;05/12/2026;fixa;Salário;";
  return `\uFEFF${header}\n${example}\n`;
}

function normalizeHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
}

function detectDelimiter(firstLine: string): ";" | "," {
  const semiCount = (firstLine.match(/;/g) ?? []).length;
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  return semiCount >= commaCount ? ";" : ",";
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseDateFlexible(raw: string): string {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return "";
}

function mapPaymentType(raw: string): "pix" | "credit" | "debit" | "" {
  const norm = normalizeHeader(raw);
  if (norm === "pix") return "pix";
  if (norm === "credit" || norm === "credito" || norm === "cartao_de_credito") return "credit";
  if (norm === "debit" || norm === "debito" || norm === "debito_em_conta") return "debit";
  return "";
}

function mapBillStatus(raw: string): "pending" | "paid" {
  const norm = normalizeHeader(raw);
  return norm === "pago" || norm === "paid" ? "paid" : "pending";
}

function mapIncomeNature(raw: string): "fixed" | "variable" | "" {
  const norm = normalizeHeader(raw);
  if (norm === "fixa" || norm === "fixed") return "fixed";
  if (norm === "variavel" || norm === "variable") return "variable";
  return "";
}

function splitNonEmptyLines(text: string): string[] {
  return text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

export function parseAndValidateBillsCsv(
  text: string,
  deps: { categories: Category[]; stores?: Store[]; banks?: Bank[] },
): CsvParseResult<BillInput> {
  const lines = splitNonEmptyLines(text);
  if (lines.length < 2) {
    return {
      validRows: [],
      invalidRows: [{ lineNumber: 1, raw: "", errors: ["Arquivo CSV sem linhas de dados."] }],
    };
  }

  const delimiter = detectDelimiter(lines[0]!);
  const headers = parseCsvLine(lines[0]!, delimiter).map(normalizeHeader);
  const dataLines = lines.slice(1, MAX_CSV_ROWS + 1);

  const validRows: BillInput[] = [];
  const invalidRows: CsvInvalidRow[] = [];

  for (let idx = 0; idx < dataLines.length; idx += 1) {
    const rawLine = dataLines[idx]!;
    const cols = parseCsvLine(rawLine, delimiter);
    const get = (name: string) => {
      const colIdx = headers.indexOf(name);
      return colIdx >= 0 ? (cols[colIdx] ?? "") : "";
    };

    const catName = get("categoria").trim().toLowerCase();
    const matchedCategory = deps.categories.find((c) => c.name.trim().toLowerCase() === catName);

    const storeName = get("empresa").trim().toLowerCase();
    const matchedStore = deps.stores?.find((s) => s.name.trim().toLowerCase() === storeName);

    const bankName = get("banco").trim().toLowerCase();
    const matchedBank = deps.banks?.find((b) => b.name.trim().toLowerCase() === bankName);

    const paymentType = mapPaymentType(get("tipo_pagamento"));
    const status = mapBillStatus(get("status"));
    const dueDate = parseDateFlexible(get("vencimento"));
    const amountCents = parseBRLToCents(get("valor"));

    const candidate = {
      description: get("descricao"),
      company: matchedStore?.name ?? (get("empresa") || null),
      category_id: matchedCategory?.id ?? "",
      amount_cents: amountCents ?? Number.NaN,
      payment_type: paymentType || "pix",
      bank: paymentType === "debit" ? (matchedBank?.name ?? get("banco") ?? null) : null,
      agency: paymentType === "debit" ? (matchedBank?.agency ?? null) : null,
      account_number: paymentType === "debit" ? (matchedBank?.account_number ?? null) : null,
      due_date: dueDate,
      status,
      paid_at: status === "paid" ? dueDate || null : null,
      ...(matchedStore ? { store_id: matchedStore.id } : {}),
      ...(matchedBank ? { bank_id: matchedBank.id } : {}),
    };

    const parsed = billSchema.safeParse(candidate);
    const rowErrors: string[] = [];
    if (!matchedCategory) {
      rowErrors.push(`Categoria "${get("categoria") || "(vazia)"}" não encontrada.`);
    }
    if (!paymentType) {
      rowErrors.push(`Tipo de pagamento "${get("tipo_pagamento")}" inválido (use pix, credito ou debito).`);
    }
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        if (!rowErrors.includes(issue.message)) rowErrors.push(issue.message);
      }
    }

    if (rowErrors.length > 0 || !parsed.success) {
      invalidRows.push({ lineNumber: idx + 2, raw: rawLine, errors: rowErrors });
    } else {
      validRows.push(parsed.data);
    }
  }

  return { validRows, invalidRows };
}

export function parseAndValidateIncomesCsv(
  text: string,
  deps: { incomeTypes: IncomeType[]; banks?: Bank[] },
): CsvParseResult<IncomeInput> {
  const lines = splitNonEmptyLines(text);
  if (lines.length < 2) {
    return {
      validRows: [],
      invalidRows: [{ lineNumber: 1, raw: "", errors: ["Arquivo CSV sem linhas de dados."] }],
    };
  }

  const delimiter = detectDelimiter(lines[0]!);
  const headers = parseCsvLine(lines[0]!, delimiter).map(normalizeHeader);
  const dataLines = lines.slice(1, MAX_CSV_ROWS + 1);

  const validRows: IncomeInput[] = [];
  const invalidRows: CsvInvalidRow[] = [];

  for (let idx = 0; idx < dataLines.length; idx += 1) {
    const rawLine = dataLines[idx]!;
    const cols = parseCsvLine(rawLine, delimiter);
    const get = (name: string) => {
      const colIdx = headers.indexOf(name);
      return colIdx >= 0 ? (cols[colIdx] ?? "") : "";
    };

    const typeName = get("tipo_renda").trim().toLowerCase();
    const matchedType = deps.incomeTypes.find((t) => t.name.trim().toLowerCase() === typeName);

    const bankName = get("banco").trim().toLowerCase();
    const matchedBank = deps.banks?.find((b) => b.name.trim().toLowerCase() === bankName);

    const nature = mapIncomeNature(get("natureza"));
    const receivedDate = parseDateFlexible(get("data"));
    const amountCents = parseBRLToCents(get("valor"));

    const candidate = {
      description: get("descricao"),
      amount_cents: amountCents ?? Number.NaN,
      received_date: receivedDate,
      nature: nature || "fixed",
      income_type_id: matchedType?.id ?? "",
      bank_id: matchedBank?.id ?? null,
    };

    const parsed = incomeSchema.safeParse(candidate);
    const rowErrors: string[] = [];
    if (!matchedType) {
      rowErrors.push(`Tipo de renda "${get("tipo_renda") || "(vazio)"}" não encontrado.`);
    }
    if (!nature) {
      rowErrors.push(`Natureza "${get("natureza")}" inválida (use fixa ou variavel).`);
    }
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        if (!rowErrors.includes(issue.message)) rowErrors.push(issue.message);
      }
    }

    if (rowErrors.length > 0 || !parsed.success) {
      invalidRows.push({ lineNumber: idx + 2, raw: rawLine, errors: rowErrors });
    } else {
      validRows.push(parsed.data);
    }
  }

  return { validRows, invalidRows };
}
