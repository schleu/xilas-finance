import { z } from "zod";

export const INCOME_NATURES = ["fixed", "variable"] as const;
export type IncomeNature = (typeof INCOME_NATURES)[number];

export const INCOME_NATURE_LABELS: Record<IncomeNature, string> = {
  fixed: "Fixa",
  variable: "Variável",
};

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.");

export const incomeTypeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Informe o nome do tipo de renda.")
    .max(60, "Máximo de 60 caracteres."),
});

export type IncomeTypeInput = z.output<typeof incomeTypeSchema>;

export const incomeSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, "Informe a descrição.")
    .max(120, "Máximo de 120 caracteres."),
  amount_cents: z
    .number({ message: "Informe um valor válido." })
    .int("O valor deve estar em centavos inteiros.")
    .positive("O valor deve ser maior que zero."),
  received_date: isoDateSchema,
  nature: z.enum(INCOME_NATURES, { message: "Selecione a natureza (fixa ou variável)." }),
  income_type_id: z.string().uuid("Selecione um tipo de renda válido."),
  bank_id: z.string().uuid().nullable().optional(),
});

export type IncomeInput = z.output<typeof incomeSchema>;
