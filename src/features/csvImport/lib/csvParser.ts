import * as XLSX from "xlsx";
import type { Bank } from "@/features/banks/api/banksApi";
import {
  BILL_STATUS_LABELS,
  PAYMENT_TYPE_LABELS,
  billSchema,
  type BillInput,
} from "@/features/bills/schemas/billSchema";
import type { Category } from "@/features/categories/api/categoriesApi";
import type { IncomeType } from "@/features/incomes/api/incomesApi";
import {
  INCOME_NATURE_LABELS,
  incomeSchema,
  type IncomeInput,
} from "@/features/incomes/schemas/incomeSchema";
import type { Store } from "@/features/stores/api/storesApi";
import { centsToBRInput, parseBRLToCents } from "@/lib/money";

export const MAX_CSV_ROWS = 500;

export interface CsvInvalidRow {
  lineNumber: number;
  raw: string;
  errors: string[];
}

export interface SpreadsheetPreviewRow<T> {
  lineNumber: number;
  cells: Record<string, string>;
  fieldErrors: Partial<Record<string, string>>;
  rowErrors: string[];
  isValid: boolean;
  parsedData?: T;
}

export interface CsvParseResult<T> {
  rows: SpreadsheetPreviewRow<T>[];
  validRows: T[];
  invalidRows: CsvInvalidRow[];
}

export function generateBillsCsvTemplate(categories: Category[] = []): string {
  const categoryOptions =
    categories.length > 0
      ? categories.map((c) => c.name).join(" | ")
      : "Fixa | Variável | Cartão de Crédito";

  const comments = [
    "# Opções de tipo_pagamento: pix | credito | debito",
    "# Opções de status: pendente | pago",
    `# Opções de categoria: ${categoryOptions}`,
    "# Formato das datas: dd/mm/yyyy (mes_referencia opcional: mm/yyyy; se vazio, usa o vencimento)",
  ];
  const header =
    "descricao;empresa;categoria;valor;vencimento;mes_referencia;tipo_pagamento;status;banco";
  const exampleCategory = categories[0]?.name ?? "Fixa";
  const example = `Internet fibra;Vivo;${exampleCategory};120,50;10/12/2026;12/2026;pix;pendente;`;
  return `\uFEFF${comments.join("\n")}\n${header}\n${example}\n`;
}

export function generateIncomesCsvTemplate(incomeTypes: IncomeType[] = []): string {
  const typeOptions =
    incomeTypes.length > 0 ? incomeTypes.map((t) => t.name).join(" | ") : "Salário | Freela | Outros";
  const comments = [
    "# Opções de natureza: fixa | variavel",
    `# Opções de tipo_renda: ${typeOptions}`,
    "# Formato das datas: dd/mm/yyyy",
  ];
  const header = "descricao;valor;data;natureza;tipo_renda;banco";
  const exampleType = incomeTypes[0]?.name ?? "Salário";
  const example = `Salário mensal;5000,00;05/12/2026;fixa;${exampleType};`;
  return `\uFEFF${comments.join("\n")}\n${header}\n${example}\n`;
}

export function sanitizeCellValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const day = String(value.getUTCDate()).padStart(2, "0");
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const year = value.getUTCFullYear();
    return `${day}/${month}/${year}`;
  }
  return String(value)
    .replace(/^\uFEFF/, "")
    .replace(/[\u00A0\u200B-\u200D\uFEFF]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHeader(value: string): string {
  return sanitizeCellValue(value)
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
      fields.push(sanitizeCellValue(current));
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(sanitizeCellValue(current));
  return fields;
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Higieniza e normaliza datas (dd/mm/yyyy, d/m/yyyy, yyyy-mm-dd, serial Excel ou Date)
 * para exibição padrão `dd/mm/yyyy` e formato ISO `yyyy-mm-dd`.
 */
export function normalizeDateToBR(raw: unknown): { display: string; iso: string } {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const year = raw.getUTCFullYear();
    const month = raw.getUTCMonth() + 1;
    const day = raw.getUTCDate();
    const dd = String(day).padStart(2, "0");
    const mm = String(month).padStart(2, "0");
    return { display: `${dd}/${mm}/${year}`, iso: `${year}-${mm}-${dd}` };
  }

  if (typeof raw === "number" && Number.isFinite(raw) && raw > 20000 && raw < 80000) {
    // Excel serial date (epoch 1899-12-30)
    const utcMs = Date.UTC(1899, 11, 30) + Math.round(raw) * 86_400_000;
    const date = new Date(utcMs);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const dd = String(day).padStart(2, "0");
    const mm = String(month).padStart(2, "0");
    return { display: `${dd}/${mm}/${year}`, iso: `${year}-${mm}-${dd}` };
  }

  const trimmed = sanitizeCellValue(raw);
  if (!trimmed) return { display: "", iso: "" };

  // Numeric string from Excel serial
  if (/^\d{5}$/.test(trimmed)) {
    return normalizeDateToBR(Number(trimmed));
  }

  const br = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(trimmed);
  if (br) {
    const day = Number(br[1]);
    const month = Number(br[2]);
    const year = Number(br[3]);
    if (isValidCalendarDate(year, month, day)) {
      const dd = String(day).padStart(2, "0");
      const mm = String(month).padStart(2, "0");
      return { display: `${dd}/${mm}/${year}`, iso: `${year}-${mm}-${dd}` };
    }
    return { display: trimmed, iso: "" };
  }

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    if (isValidCalendarDate(year, month, day)) {
      return { display: `${iso[3]}/${iso[2]}/${iso[1]}`, iso: trimmed };
    }
    return { display: trimmed, iso: "" };
  }

  return { display: trimmed, iso: "" };
}

function normalizeReferenceMonthCell(
  raw: string,
  fallbackDueIso: string,
): { display: string; iso: string; valid: boolean } {
  const cleaned = sanitizeCellValue(raw);
  if (!cleaned) {
    if (fallbackDueIso) {
      const year = fallbackDueIso.slice(0, 4);
      const month = fallbackDueIso.slice(5, 7);
      return { display: `${month}/${year}`, iso: `${year}-${month}-01`, valid: true };
    }
    return { display: "", iso: "", valid: true };
  }

  const brMonth = /^(\d{1,2})[/-](\d{4})$/.exec(cleaned);
  if (brMonth) {
    const m = Number(brMonth[1]);
    const y = Number(brMonth[2]);
    if (m >= 1 && m <= 12) {
      const mm = String(m).padStart(2, "0");
      return { display: `${mm}/${y}`, iso: `${y}-${mm}-01`, valid: true };
    }
    return { display: cleaned, iso: "", valid: false };
  }

  const isoMonth = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(cleaned);
  if (isoMonth) {
    const y = Number(isoMonth[1]);
    const m = Number(isoMonth[2]);
    if (m >= 1 && m <= 12) {
      const mm = String(m).padStart(2, "0");
      return { display: `${mm}/${y}`, iso: `${y}-${mm}-01`, valid: true };
    }
    return { display: cleaned, iso: "", valid: false };
  }

  return { display: cleaned, iso: "", valid: false };
}

function mapPaymentType(raw: string): "pix" | "credit" | "debit" | "" {
  const norm = normalizeHeader(raw);
  if (norm === "pix") return "pix";
  if (norm === "credit" || norm === "credito" || norm === "cartao_de_credito" || norm === "cartao")
    return "credit";
  if (norm === "debit" || norm === "debito" || norm === "debito_em_conta") return "debit";
  return "";
}

function mapBillStatus(raw: string): "pending" | "paid" | "" {
  const norm = normalizeHeader(raw);
  if (!norm || norm === "pendente" || norm === "pending" || norm === "aberto" || norm === "em_aberto") {
    return "pending";
  }
  if (norm === "pago" || norm === "paga" || norm === "paid") {
    return "paid";
  }
  return "";
}

function mapIncomeNature(raw: string): "fixed" | "variable" | "" {
  const norm = normalizeHeader(raw);
  if (norm === "fixa" || norm === "fixo" || norm === "fixed") return "fixed";
  if (norm === "variavel" || norm === "variable") return "variable";
  return "";
}

function splitNonEmptyCsvLines(text: string): string[] {
  return text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
}

export function csvTextToMatrix(text: string): unknown[][] {
  const lines = splitNonEmptyCsvLines(text);
  if (lines.length === 0) return [];
  const delimiter = detectDelimiter(lines[0]!);
  return lines.map((line) => parseCsvLine(line, delimiter));
}

export function workbookBufferToMatrix(buffer: ArrayBuffer): unknown[][] {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) return [];
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: "",
  });
  return rawRows.filter((row) => {
    const nonEmpty = row.some((cell) => sanitizeCellValue(cell).length > 0);
    if (!nonEmpty) return false;
    const firstCell = sanitizeCellValue(row[0]);
    return !firstCell.startsWith("#");
  });
}

export function decodeCsvBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

export async function readSpreadsheetFile(file: File): Promise<unknown[][]> {
  const name = file.name.toLowerCase();
  const buffer = await file.arrayBuffer();
  if (name.endsWith(".xls") || name.endsWith(".xlsx")) {
    return workbookBufferToMatrix(buffer);
  }
  return csvTextToMatrix(decodeCsvBuffer(buffer));
}

export function parseAndValidateBillsMatrix(
  matrix: unknown[][],
  deps: { categories: Category[]; stores?: Store[]; banks?: Bank[] },
): CsvParseResult<BillInput> {
  if (matrix.length < 2) {
    return {
      rows: [],
      validRows: [],
      invalidRows: [{ lineNumber: 1, raw: "", errors: ["Arquivo sem linhas de dados."] }],
    };
  }

  const headers = (matrix[0] ?? []).map((h) => normalizeHeader(String(h ?? "")));
  const dataRows = matrix.slice(1, MAX_CSV_ROWS + 1);

  const rows: SpreadsheetPreviewRow<BillInput>[] = [];
  const validRows: BillInput[] = [];
  const invalidRows: CsvInvalidRow[] = [];

  for (let idx = 0; idx < dataRows.length; idx += 1) {
    const rawCols = dataRows[idx] ?? [];
    const getRaw = (name: string): unknown => {
      const colIdx = headers.indexOf(name);
      return colIdx >= 0 ? (rawCols[colIdx] ?? "") : "";
    };
    const get = (name: string): string => sanitizeCellValue(getRaw(name));

    const description = get("descricao");
    const rawCompany = get("empresa");
    const rawCategory = get("categoria");
    const rawAmount = get("valor");
    const dueNormalized = normalizeDateToBR(getRaw("vencimento"));
    const refMonthNormalized = normalizeReferenceMonthCell(
      get("mes_referencia"),
      dueNormalized.iso,
    );
    const rawPaymentType = get("tipo_pagamento");
    const rawStatus = get("status");
    const rawBank = get("banco");

    const matchedCategory = deps.categories.find(
      (c) => c.name.trim().toLowerCase() === rawCategory.toLowerCase(),
    );
    const matchedStore = deps.stores?.find(
      (s) => s.name.trim().toLowerCase() === rawCompany.toLowerCase(),
    );
    const matchedBank = deps.banks?.find(
      (b) => b.name.trim().toLowerCase() === rawBank.toLowerCase(),
    );

    const paymentType = mapPaymentType(rawPaymentType);
    const status = mapBillStatus(rawStatus);
    const amountCents = parseBRLToCents(rawAmount);

    const displayCells: Record<string, string> = {
      descricao: description,
      empresa: matchedStore?.name ?? rawCompany,
      categoria: matchedCategory?.name ?? rawCategory,
      valor: amountCents !== null && amountCents > 0 ? centsToBRInput(amountCents) : rawAmount,
      vencimento: dueNormalized.display,
      mes_referencia: refMonthNormalized.display,
      tipo_pagamento: paymentType ? PAYMENT_TYPE_LABELS[paymentType] : rawPaymentType,
      status: status ? BILL_STATUS_LABELS[status] : rawStatus,
      banco: matchedBank?.name ?? rawBank,
    };

    const candidate = {
      description,
      company: matchedStore?.name ?? (rawCompany || null),
      category_id: matchedCategory?.id ?? "",
      amount_cents: amountCents ?? Number.NaN,
      payment_type: paymentType || "pix",
      bank: paymentType === "debit" ? (matchedBank?.name ?? (rawBank || null)) : null,
      agency: paymentType === "debit" ? (matchedBank?.agency ?? null) : null,
      account_number: paymentType === "debit" ? (matchedBank?.account_number ?? null) : null,
      due_date: dueNormalized.iso,
      reference_month: refMonthNormalized.iso || null,
      status: status || "pending",
      paid_at: status === "paid" ? dueNormalized.iso || null : null,
      ...(matchedStore ? { store_id: matchedStore.id } : {}),
      ...(matchedBank ? { bank_id: matchedBank.id } : {}),
    };

    const parsed = billSchema.safeParse(candidate);
    const fieldErrors: Partial<Record<string, string>> = {};
    const rowErrors: string[] = [];

    const addFieldError = (field: string, msg: string) => {
      if (!fieldErrors[field]) fieldErrors[field] = msg;
      if (!rowErrors.includes(msg)) rowErrors.push(msg);
    };

    if (!description) {
      addFieldError("descricao", "Informe a descrição.");
    }
    if (!matchedCategory) {
      addFieldError("categoria", `Categoria "${rawCategory || "(vazia)"}" não encontrada.`);
    }
    if (amountCents === null || amountCents <= 0) {
      addFieldError("valor", "Valor inválido (deve ser maior que zero).");
    }
    if (!dueNormalized.iso) {
      addFieldError("vencimento", "Data inválida (use dd/mm/yyyy).");
    }
    if (!refMonthNormalized.valid) {
      addFieldError("mes_referencia", "Mês de referência inválido (use mm/yyyy).");
    }
    if (!paymentType) {
      addFieldError(
        "tipo_pagamento",
        `Tipo "${rawPaymentType || "(vazio)"}" inválido (use pix, credito ou debito).`,
      );
    }
    if (!status) {
      addFieldError("status", `Status "${rawStatus}" inválido (use pendente ou pago).`);
    }
    if (paymentType === "debit" && (!matchedBank || !matchedBank.agency || !matchedBank.account_number)) {
      addFieldError(
        "banco",
        rawBank
          ? `Banco "${rawBank}" não encontrado com agência e conta cadastradas.`
          : "Débito em conta exige um banco cadastrado com agência e conta.",
      );
    }

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const pathKey = String(issue.path[0] ?? "");
        const colMap: Record<string, string> = {
          description: "descricao",
          category_id: "categoria",
          amount_cents: "valor",
          due_date: "vencimento",
          reference_month: "mes_referencia",
          payment_type: "tipo_pagamento",
          status: "status",
          bank: "banco",
          agency: "banco",
          account_number: "banco",
        };
        const col = colMap[pathKey];
        if (col) {
          addFieldError(col, issue.message);
        } else if (!rowErrors.includes(issue.message)) {
          rowErrors.push(issue.message);
        }
      }
    }

    const lineNumber = idx + 2;
    const isValid = rowErrors.length === 0 && parsed.success;

    rows.push({
      lineNumber,
      cells: displayCells,
      fieldErrors,
      rowErrors,
      isValid,
      parsedData: isValid ? parsed.data : undefined,
    });

    if (isValid && parsed.success) {
      validRows.push(parsed.data);
    } else {
      invalidRows.push({
        lineNumber,
        raw: rawCols.map((c) => sanitizeCellValue(c)).join(";"),
        errors: rowErrors,
      });
    }
  }

  return { rows, validRows, invalidRows };
}

export function parseAndValidateBillsCsv(
  text: string,
  deps: { categories: Category[]; stores?: Store[]; banks?: Bank[] },
): CsvParseResult<BillInput> {
  return parseAndValidateBillsMatrix(csvTextToMatrix(text), deps);
}

export function parseAndValidateIncomesMatrix(
  matrix: unknown[][],
  deps: { incomeTypes: IncomeType[]; banks?: Bank[] },
): CsvParseResult<IncomeInput> {
  if (matrix.length < 2) {
    return {
      rows: [],
      validRows: [],
      invalidRows: [{ lineNumber: 1, raw: "", errors: ["Arquivo sem linhas de dados."] }],
    };
  }

  const headers = (matrix[0] ?? []).map((h) => normalizeHeader(String(h ?? "")));
  const dataRows = matrix.slice(1, MAX_CSV_ROWS + 1);

  const rows: SpreadsheetPreviewRow<IncomeInput>[] = [];
  const validRows: IncomeInput[] = [];
  const invalidRows: CsvInvalidRow[] = [];

  for (let idx = 0; idx < dataRows.length; idx += 1) {
    const rawCols = dataRows[idx] ?? [];
    const getRaw = (name: string): unknown => {
      const colIdx = headers.indexOf(name);
      return colIdx >= 0 ? (rawCols[colIdx] ?? "") : "";
    };
    const get = (name: string): string => sanitizeCellValue(getRaw(name));

    const description = get("descricao");
    const rawAmount = get("valor");
    const dateNormalized = normalizeDateToBR(getRaw("data"));
    const rawNature = get("natureza");
    const rawType = get("tipo_renda");
    const rawBank = get("banco");

    const matchedType = deps.incomeTypes.find(
      (t) => t.name.trim().toLowerCase() === rawType.toLowerCase(),
    );
    const matchedBank = deps.banks?.find(
      (b) => b.name.trim().toLowerCase() === rawBank.toLowerCase(),
    );
    const nature = mapIncomeNature(rawNature);
    const amountCents = parseBRLToCents(rawAmount);

    const displayCells: Record<string, string> = {
      descricao: description,
      valor: amountCents !== null && amountCents > 0 ? centsToBRInput(amountCents) : rawAmount,
      data: dateNormalized.display,
      natureza: nature ? INCOME_NATURE_LABELS[nature] : rawNature,
      tipo_renda: matchedType?.name ?? rawType,
      banco: matchedBank?.name ?? rawBank,
    };

    const candidate = {
      description,
      amount_cents: amountCents ?? Number.NaN,
      received_date: dateNormalized.iso,
      nature: nature || "fixed",
      income_type_id: matchedType?.id ?? "",
      bank_id: matchedBank?.id ?? null,
    };

    const parsed = incomeSchema.safeParse(candidate);
    const fieldErrors: Partial<Record<string, string>> = {};
    const rowErrors: string[] = [];

    const addFieldError = (field: string, msg: string) => {
      if (!fieldErrors[field]) fieldErrors[field] = msg;
      if (!rowErrors.includes(msg)) rowErrors.push(msg);
    };

    if (!description) addFieldError("descricao", "Informe a descrição.");
    if (amountCents === null || amountCents <= 0) {
      addFieldError("valor", "Valor inválido (deve ser maior que zero).");
    }
    if (!dateNormalized.iso) {
      addFieldError("data", "Data inválida (use dd/mm/yyyy).");
    }
    if (!nature) {
      addFieldError("natureza", `Natureza "${rawNature || "(vazia)"}" inválida (use fixa ou variavel).`);
    }
    if (!matchedType) {
      addFieldError("tipo_renda", `Tipo de renda "${rawType || "(vazio)"}" não encontrado.`);
    }

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const pathKey = String(issue.path[0] ?? "");
        const colMap: Record<string, string> = {
          description: "descricao",
          amount_cents: "valor",
          received_date: "data",
          nature: "natureza",
          income_type_id: "tipo_renda",
        };
        const col = colMap[pathKey];
        if (col) addFieldError(col, issue.message);
        else if (!rowErrors.includes(issue.message)) rowErrors.push(issue.message);
      }
    }

    const lineNumber = idx + 2;
    const isValid = rowErrors.length === 0 && parsed.success;

    rows.push({
      lineNumber,
      cells: displayCells,
      fieldErrors,
      rowErrors,
      isValid,
      parsedData: isValid ? parsed.data : undefined,
    });

    if (isValid && parsed.success) {
      validRows.push(parsed.data);
    } else {
      invalidRows.push({
        lineNumber,
        raw: rawCols.map((c) => sanitizeCellValue(c)).join(";"),
        errors: rowErrors,
      });
    }
  }

  return { rows, validRows, invalidRows };
}

export function parseAndValidateIncomesCsv(
  text: string,
  deps: { incomeTypes: IncomeType[]; banks?: Bank[] },
): CsvParseResult<IncomeInput> {
  return parseAndValidateIncomesMatrix(csvTextToMatrix(text), deps);
}
