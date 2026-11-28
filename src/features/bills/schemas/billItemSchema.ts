import { z } from "zod";

export const SUPERMARKET_PAYMENT_METHODS = [
  "credit",
  "debit_card",
  "food_voucher",
  "meal_voucher",
  "pix",
  "cash",
] as const;
export type SupermarketPaymentMethod = (typeof SUPERMARKET_PAYMENT_METHODS)[number];

export const SUPERMARKET_PAYMENT_LABELS: Record<SupermarketPaymentMethod, string> = {
  credit: "Cartão de crédito",
  debit_card: "Cartão de débito",
  food_voucher: "Vale-alimentação",
  meal_voucher: "Vale-refeição",
  pix: "Pix",
  cash: "Dinheiro",
};

export const BILL_ITEM_CATEGORIES = [
  "food",
  "cleaning",
  "hygiene",
  "beverages",
  "produce",
  "bakery_butcher",
  "other",
] as const;
export type BillItemCategory = (typeof BILL_ITEM_CATEGORIES)[number];

export const BILL_ITEM_CATEGORY_LABELS: Record<BillItemCategory, string> = {
  food: "Alimento",
  cleaning: "Limpeza",
  hygiene: "Higiene",
  beverages: "Bebidas",
  produce: "Hortifruti",
  bakery_butcher: "Padaria/Açougue",
  other: "Outros",
};

export const BILL_ITEM_UNITS = ["un", "kg", "g", "l", "ml", "pct"] as const;
export type BillItemUnit = (typeof BILL_ITEM_UNITS)[number];

export const billItemSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, "Informe a descrição do subitem.")
    .max(160, "Máximo de 160 caracteres."),
  item_category: z.enum(BILL_ITEM_CATEGORIES).default("other"),
  quantity: z.number().positive("Quantidade deve ser maior que zero."),
  unit: z.enum(BILL_ITEM_UNITS).default("un"),
  unit_price_cents: z
    .number()
    .int("Valor unitário deve estar em centavos inteiros.")
    .positive("Valor unitário deve ser maior que zero."),
  total_cents: z
    .number()
    .int("Valor total deve estar em centavos inteiros.")
    .positive("Valor total deve ser maior que zero."),
});

export type BillItemInput = z.output<typeof billItemSchema>;
