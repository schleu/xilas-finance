import type { BillItemCategory } from "../../src/features/bills/schemas/billItemSchema.js";

const CATEGORY_KEYWORDS: ReadonlyArray<{ category: BillItemCategory; words: string[] }> = [
  {
    category: "cleaning",
    words: ["sabao", "detergente", "amaciante", "agua sanitaria", "desinfetante", "esponja", "alvejante", "limpa", "cloro", "multiuso"],
  },
  {
    category: "hygiene",
    words: ["shampoo", "condicionador", "sabonete", "creme dental", "pasta de dente", "escova", "papel higienico", "desodorante", "absorvente", "fralda"],
  },
  {
    category: "beverages",
    words: ["refrigerante", "suco", "agua mineral", "cerveja", "vinho", "cafe", "cha", "achocolatado", "energetico", "coca", "guarana"],
  },
  {
    category: "produce",
    words: ["banana", "maca", "tomate", "cebola", "batata", "alface", "cenoura", "laranja", "limao", "uva", "mamao", "melancia", "alho", "abacate"],
  },
  {
    category: "bakery_butcher",
    words: ["pao", "bolo", "carne", "frango", "peito", "acem", "patinho", "linguica", "salsicha", "presunto", "queijo", "peixe", "bife", "costela"],
  },
  {
    category: "food",
    words: ["arroz", "feijao", "macarrao", "oleo", "azeite", "acucar", "sal", "leite", "farinha", "biscoito", "manteiga", "margarina", "ovo", "molho", "iogurte"],
  },
];

export function classifySupermarketItem(description: string): BillItemCategory {
  const normalized = description
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  for (const rule of CATEGORY_KEYWORDS) {
    if (rule.words.some((w) => normalized.includes(w))) {
      return rule.category;
    }
  }
  return "other";
}
