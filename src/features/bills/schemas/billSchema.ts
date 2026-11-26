import { z } from "zod";

export const PAYMENT_TYPES = ["pix", "credit", "debit"] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const BILL_STATUSES = ["pending", "paid"] as const;
export type BillStatus = (typeof BILL_STATUSES)[number];

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  pix: "Pix",
  credit: "Cartão de crédito",
  debit: "Débito em conta",
};

export const BILL_STATUS_LABELS: Record<BillStatus, string> = {
  pending: "Pendente",
  paid: "Pago",
};

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.");

const optionalTrimmedString = z
  .string()
  .nullable()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim() ?? "";
    return trimmed.length > 0 ? trimmed : null;
  });

export const billSchema = z
  .object({
    description: z
      .string()
      .trim()
      .min(1, "Informe a descrição.")
      .max(120, "Máximo de 120 caracteres."),
    company: optionalTrimmedString,
    category_id: z.string().uuid("Selecione uma categoria válida."),
    amount_cents: z
      .number({ message: "Informe um valor válido." })
      .int("O valor deve estar em centavos inteiros.")
      .positive("O valor deve ser maior que zero."),
    payment_type: z.enum(PAYMENT_TYPES, { message: "Selecione o tipo de pagamento." }),
    bank: optionalTrimmedString,
    agency: optionalTrimmedString,
    account_number: optionalTrimmedString,
    due_date: isoDateSchema,
    status: z.enum(BILL_STATUSES, { message: "Selecione o status." }),
    paid_at: z
      .union([isoDateSchema, z.literal(""), z.null()])
      .optional()
      .transform((value) => (value ? value : null)),
  })
  .superRefine((data, ctx) => {
    if (data.payment_type === "debit") {
      if (!data.bank) {
        ctx.addIssue({ code: "custom", path: ["bank"], message: "Informe o banco." });
      }
      if (!data.agency) {
        ctx.addIssue({ code: "custom", path: ["agency"], message: "Informe a agência." });
      }
      if (!data.account_number) {
        ctx.addIssue({
          code: "custom",
          path: ["account_number"],
          message: "Informe a conta.",
        });
      }
    }

    if (data.status === "pending" && data.paid_at !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["paid_at"],
        message: "Data de pagamento só pode ser preenchida para contas pagas.",
      });
    }
  })
  .transform((data) => {
    if (data.payment_type !== "debit") {
      return {
        ...data,
        bank: null,
        agency: null,
        account_number: null,
      };
    }
    return data;
  });

export type BillInput = z.output<typeof billSchema>;

const fortalezaDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Fortaleza",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Data atual ("YYYY-MM-DD") no fuso America/Fortaleza (constituição). */
export function todayIsoFortaleza(now: Date = new Date()): string {
  return fortalezaDateFormatter.format(now);
}

/** Mês atual ("YYYY-MM") no fuso America/Fortaleza. */
export function currentMonthFortaleza(now: Date = new Date()): string {
  return todayIsoFortaleza(now).slice(0, 7);
}

/** "Atrasado" é derivado: pendente com vencimento anterior a hoje (spec US-2). */
export function isBillOverdue(
  bill: { status: BillStatus; due_date: string },
  todayIso: string = todayIsoFortaleza(),
): boolean {
  return bill.status === "pending" && bill.due_date < todayIso;
}

/** Mascara agência e conta na listagem (ex.: "001234" -> "••••1234"). */
export function maskBankCode(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "";
  if (trimmed.length <= 4) return "••••";
  return `••••${trimmed.slice(-4)}`;
}
