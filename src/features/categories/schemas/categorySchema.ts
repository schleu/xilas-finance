import { z } from "zod";

export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Informe o nome da categoria.")
    .max(60, "Máximo de 60 caracteres."),
});

export type CategoryInput = z.infer<typeof categorySchema>;
