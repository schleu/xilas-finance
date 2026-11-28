import { z } from "zod";

const optionalTrimmedString = z
  .string()
  .nullable()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim() ?? "";
    return trimmed.length > 0 ? trimmed : null;
  });

export const bankSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Informe o nome do banco.")
      .max(80, "Máximo de 80 caracteres."),
    has_debit_account: z.boolean().default(false),
    agency: optionalTrimmedString,
    account_number: optionalTrimmedString,
    has_credit_card: z.boolean().default(false),
    credit_card_label: optionalTrimmedString,
    credit_card_due_day: z
      .number()
      .int("Informe um dia inteiro entre 1 e 31.")
      .min(1, "Dia de vencimento deve ser entre 1 e 31.")
      .max(31, "Dia de vencimento deve ser entre 1 e 31.")
      .nullable()
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.has_debit_account) {
      if (!data.agency) {
        ctx.addIssue({ code: "custom", path: ["agency"], message: "Informe a agência." });
      }
      if (!data.account_number) {
        ctx.addIssue({ code: "custom", path: ["account_number"], message: "Informe a conta." });
      }
    }
    if (data.has_credit_card && data.credit_card_due_day == null) {
      ctx.addIssue({
        code: "custom",
        path: ["credit_card_due_day"],
        message: "Informe o dia de vencimento do cartão (1 a 31).",
      });
    }
  })
  .transform((data) => ({
    ...data,
    agency: data.has_debit_account ? data.agency : null,
    account_number: data.has_debit_account ? data.account_number : null,
    credit_card_label: data.has_credit_card ? data.credit_card_label : null,
    credit_card_due_day: data.has_credit_card ? (data.credit_card_due_day ?? null) : null,
  }));

export type BankInput = z.output<typeof bankSchema>;
