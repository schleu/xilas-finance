import { z } from "zod";

export const STORE_TYPES = ["online", "physical"] as const;
export type StoreType = (typeof STORE_TYPES)[number];

export const STORE_SUBTYPES = ["supermarket", "other"] as const;
export type StoreSubtype = (typeof STORE_SUBTYPES)[number];

export const STORE_TYPE_LABELS: Record<StoreType, string> = {
  online: "Online",
  physical: "Física",
};

export const STORE_SUBTYPE_LABELS: Record<StoreSubtype, string> = {
  supermarket: "Supermercado",
  other: "Outro",
};

export const storeSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Informe o nome da loja.")
      .max(80, "Máximo de 80 caracteres."),
    store_type: z.enum(STORE_TYPES, { message: "Selecione o tipo de loja." }),
    store_subtype: z.enum(STORE_SUBTYPES).nullable().optional(),
  })
  .transform((data) => ({
    ...data,
    store_subtype: data.store_type === "physical" ? (data.store_subtype ?? "other") : null,
  }));

export type StoreInput = z.output<typeof storeSchema>;
