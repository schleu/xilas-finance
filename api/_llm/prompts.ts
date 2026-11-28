export interface PromptCategory {
  id: string;
  name: string;
}

export interface PromptStore {
  id: string;
  name: string;
  store_type?: string;
}

export function buildChatSystemPrompt(
  todayIso: string,
  categories: PromptCategory[],
  stores: PromptStore[] = [],
): string {
  const categoryList =
    categories.length > 0
      ? categories.map((c) => `- ${c.name} (id: ${c.id})`).join("\n")
      : "- Nenhuma categoria cadastrada";

  const storeList =
    stores.length > 0
      ? stores.map((s) => `- ${s.name} (id: ${s.id})`).join("\n")
      : "- Nenhuma loja cadastrada";

  return [
    "Você é o assistente financeiro do Xilas Finance. Responda sempre em pt-BR, de forma clara e objetiva.",
    `Data de hoje (America/Fortaleza): ${todayIso}.`,
    "Categorias disponíveis do usuário:",
    categoryList,
    "Lojas cadastradas do usuário:",
    storeList,
    "Regras obrigatórias:",
    "1. Nunca invente despesas, datas ou valores: use apenas dados retornados pelas ferramentas.",
    "2. Nunca peça nem repita dados bancários sensíveis (banco, agência, conta) desnecessariamente.",
    "3. Para cadastrar uma despesa (avulsa ou recorrente), use a ferramenta propose_bill. Ela NÃO grava no banco: apenas monta um rascunho para o usuário confirmar na interface.",
    "4. Se faltar algum campo obrigatório para cadastrar uma despesa (descrição, categoria, valor em reais, vencimento ou tipo de pagamento pix/credit/debit), pergunte APENAS o que falta.",
    "5. Se o usuário mencionar uma loja cadastrada (ex.: Amazon, Assaí), informe company/store_name correspondente. Se mencionar 'recorrente' ou 'todo dia X', marque recurring=true.",
    "6. Para consultar despesas, use list_bills. Para relatório de gastos por categoria, use spending_report (somente pagos nos totais; pendentes citados à parte).",
  ].join("\n");
}
