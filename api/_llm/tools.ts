import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { billSchema } from "../../src/features/bills/schemas/billSchema.js";
import { incomeSchema } from "../../src/features/incomes/schemas/incomeSchema.js";
import { monthRange } from "../../src/lib/dates.js";
import type { LlmToolDefinition } from "./provider.js";
import type { PromptCategory, PromptStore } from "./prompts.js";

/**
 * Colunas explícitas de `bills` para o chatbot.
 * Constituição §3 / US-4: banco, agência e conta NUNCA são selecionados nem enviados ao LLM.
 */
export const SAFE_CHAT_BILL_COLUMNS =
  "id, description, company, category_id, amount_cents, payment_type, due_date, status, paid_at, recurring_rule_id, categories(name)";

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const listBillsArgsSchema = z.object({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  status: z.enum(["all", "pending", "paid", "overdue"]).optional().default("all"),
  category_name: z.string().trim().optional(),
});

const spendingReportArgsSchema = z.object({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});

export interface SafeChatBill {
  id: string;
  description: string;
  company: string | null;
  category_name: string;
  amount_cents: number;
  payment_type: "pix" | "credit" | "debit";
  due_date: string;
  status: "pending" | "paid";
  paid_at: string | null;
  is_overdue: boolean;
  is_recurring: boolean;
}

export const CHAT_READ_TOOLS: LlmToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "list_bills",
      description:
        "Lista contas reais do usuário autenticado (sem dados bancários), com filtros opcionais por período de vencimento, status e categoria.",
      parameters: {
        type: "object",
        properties: {
          from: { type: "string", description: "Data inicial de vencimento (YYYY-MM-DD)" },
          to: { type: "string", description: "Data final de vencimento (YYYY-MM-DD)" },
          status: {
            type: "string",
            enum: ["all", "pending", "paid", "overdue"],
            description: "Filtro de status (overdue = pendentes com vencimento anterior a hoje)",
          },
          category_name: { type: "string", description: "Nome da categoria para filtrar" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "spending_report",
      description:
        "Gera relatório de gasto por categoria no período (padrão: mês atual). Soma somente lançamentos pagos, citando pendentes à parte.",
      parameters: {
        type: "object",
        properties: {
          from: { type: "string", description: "Data inicial (YYYY-MM-DD)" },
          to: { type: "string", description: "Data final (YYYY-MM-DD)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_bill",
      description:
        "Monta um rascunho validado de conta para confirmação explícita do usuário na interface. NUNCA grava no banco.",
      parameters: {
        type: "object",
        properties: {
          description: { type: "string", description: "Descrição da conta (1-120 chars)" },
          company: { type: "string", description: "Empresa (opcional)" },
          category_id: { type: "string", description: "UUID da categoria do usuário" },
          category_name: { type: "string", description: "Nome da categoria (alternativa ao ID)" },
          amount_cents: { type: "integer", description: "Valor em centavos inteiros (> 0)" },
          payment_type: { type: "string", enum: ["pix", "credit", "debit"] },
          bank: { type: "string", description: "Obrigatório apenas se payment_type = debit" },
          agency: { type: "string", description: "Obrigatório apenas se payment_type = debit" },
          account_number: {
            type: "string",
            description: "Obrigatório apenas se payment_type = debit",
          },
          due_date: { type: "string", description: "Data de vencimento (YYYY-MM-DD)" },
          status: { type: "string", enum: ["pending", "paid"] },
          paid_at: { type: "string", description: "Data de pagamento (YYYY-MM-DD, só se paid)" },
          recurring: { type: "boolean", description: "Se a conta é recorrente mensalmente" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_income",
      description:
        "Monta um rascunho validado de renda para confirmação explícita do usuário na interface. NUNCA grava no banco.",
      parameters: {
        type: "object",
        properties: {
          description: { type: "string", description: "Descrição da renda (1-120 chars)" },
          amount_cents: { type: "integer", description: "Valor em centavos inteiros (> 0)" },
          received_date: { type: "string", description: "Data do recebimento (YYYY-MM-DD)" },
          nature: { type: "string", enum: ["fixed", "variable"], description: "Fixa ou variável" },
          income_type_id: { type: "string", description: "UUID do tipo de renda" },
          income_type_name: { type: "string", description: "Nome do tipo de renda (ex.: Salário, Freela, Outros)" },
        },
      },
    },
  },
];

export interface ToolContext {
  supabase: SupabaseClient;
  categories: PromptCategory[];
  stores?: PromptStore[];
  incomeTypes?: PromptCategory[];
  todayIso: string;
}

export async function runListBillsTool(
  rawArgs: unknown,
  ctx: ToolContext,
): Promise<{ bills: SafeChatBill[]; count: number }> {
  const args = listBillsArgsSchema.parse(rawArgs ?? {});

  let query = ctx.supabase
    .from("bills")
    .select(SAFE_CHAT_BILL_COLUMNS)
    .order("due_date", { ascending: true })
    .limit(50);

  if (args.from) {
    query = query.gte("due_date", args.from);
  }
  if (args.to) {
    query = query.lte("due_date", args.to);
  }
  if (args.status === "pending" || args.status === "paid") {
    query = query.eq("status", args.status);
  } else if (args.status === "overdue") {
    query = query.eq("status", "pending").lt("due_date", ctx.todayIso);
  }
  if (args.category_name) {
    const normalized = args.category_name.toLowerCase();
    const matched = ctx.categories.find((c) => c.name.toLowerCase() === normalized);
    if (matched) {
      query = query.eq("category_id", matched.id);
    }
  }

  const { data, error } = await query;
  if (error) {
    throw new Error("Não foi possível consultar suas contas.");
  }

  type RawRow = {
    id: string;
    description: string;
    company: string | null;
    amount_cents: number;
    payment_type: "pix" | "credit" | "debit";
    due_date: string;
    status: "pending" | "paid";
    paid_at: string | null;
    recurring_rule_id?: string | null;
    categories?: { name: string } | { name: string }[] | null;
  };

  // Explicit whitelist mapping guarantees bank/agency/account_number are never forwarded to the LLM
  const bills: SafeChatBill[] = ((data ?? []) as unknown as RawRow[]).map((row) => {
    const cat = Array.isArray(row.categories) ? row.categories[0] : row.categories;
    return {
      id: row.id,
      description: row.description,
      company: row.company ?? null,
      category_name: cat?.name ?? "Sem categoria",
      amount_cents: Number(row.amount_cents),
      payment_type: row.payment_type,
      due_date: row.due_date,
      status: row.status,
      paid_at: row.paid_at ?? null,
      is_overdue: row.status === "pending" && row.due_date < ctx.todayIso,
      is_recurring: Boolean(row.recurring_rule_id),
    };
  });

  return { bills, count: bills.length };
}

export async function runSpendingReportTool(
  rawArgs: unknown,
  ctx: ToolContext,
): Promise<{
  from: string;
  to: string;
  paid_total_cents: number;
  pending_total_cents: number;
  by_category: Array<{
    category_id: string;
    category_name: string;
    paid_total_cents: number;
    bills_count: number;
  }>;
}> {
  const args = spendingReportArgsSchema.parse(rawArgs ?? {});
  const defaultRange = monthRange(ctx.todayIso.slice(0, 7));
  const from = args.from ?? defaultRange.from;
  const to = args.to ?? defaultRange.to;

  const { data: categoryRows, error: rpcError } = await ctx.supabase.rpc("spending_by_category", {
    p_from: from,
    p_to: to,
  });

  if (rpcError) {
    throw new Error("Não foi possível gerar o relatório de gastos por categoria.");
  }

  const byCategory = (
    (categoryRows ?? []) as Array<{
      category_id: string;
      category_name: string;
      paid_total_cents: number | string;
      bills_count: number | string;
    }>
  ).map((row) => ({
    category_id: row.category_id,
    category_name: row.category_name,
    paid_total_cents: Number(row.paid_total_cents),
    bills_count: Number(row.bills_count),
  }));

  const paidTotalCents = byCategory.reduce((sum, item) => sum + item.paid_total_cents, 0);

  // Pending bills cited separately (US-4): select only amount_cents (no bank fields)
  const { data: pendingRows } = await ctx.supabase
    .from("bills")
    .select("amount_cents")
    .eq("status", "pending")
    .gte("due_date", from)
    .lte("due_date", to);

  const pendingTotalCents = ((pendingRows ?? []) as Array<{ amount_cents: number | string }>).reduce(
    (sum, row) => sum + Number(row.amount_cents),
    0,
  );

  return {
    from,
    to,
    paid_total_cents: paidTotalCents,
    pending_total_cents: pendingTotalCents,
    by_category: byCategory,
  };
}

export function runProposeBillTool(
  rawArgs: unknown,
  ctx: ToolContext,
): { toolOutput: unknown; proposedBill?: unknown } {
  const input = (rawArgs && typeof rawArgs === "object" ? rawArgs : {}) as Record<string, unknown>;

  let resolvedCategory =
    typeof input.category_id === "string"
      ? ctx.categories.find((c) => c.id === input.category_id)
      : undefined;

  if (!resolvedCategory && typeof input.category_name === "string") {
    const target = input.category_name.trim().toLowerCase();
    resolvedCategory = ctx.categories.find((c) => c.name.trim().toLowerCase() === target);
  }

  let resolvedStore =
    typeof input.store_id === "string"
      ? ctx.stores?.find((s) => s.id === input.store_id)
      : undefined;

  if (!resolvedStore && typeof input.company === "string" && ctx.stores?.length) {
    const targetStore = input.company.trim().toLowerCase();
    resolvedStore = ctx.stores.find((s) => s.name.trim().toLowerCase() === targetStore);
  }

  const candidate = {
    description: typeof input.description === "string" ? input.description : "",
    company: resolvedStore?.name ?? (typeof input.company === "string" ? input.company : null),
    category_id: resolvedCategory?.id ?? (typeof input.category_id === "string" ? input.category_id : ""),
    amount_cents: typeof input.amount_cents === "number" ? input.amount_cents : Number.NaN,
    payment_type: input.payment_type,
    bank: input.payment_type === "debit" && typeof input.bank === "string" ? input.bank : null,
    agency: input.payment_type === "debit" && typeof input.agency === "string" ? input.agency : null,
    account_number:
      input.payment_type === "debit" && typeof input.account_number === "string"
        ? input.account_number
        : null,
    due_date: typeof input.due_date === "string" ? input.due_date : "",
    status: input.status === "paid" ? "paid" : "pending",
    paid_at:
      input.status === "paid"
        ? typeof input.paid_at === "string" && input.paid_at
          ? input.paid_at
          : ctx.todayIso
        : null,
    ...(resolvedStore ? { store_id: resolvedStore.id } : {}),
  };

  const parsed = billSchema.safeParse(candidate);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => ({
      field: String(issue.path[0] ?? "form"),
      message: issue.message,
    }));
    return {
      toolOutput: {
        ok: false,
        instruction: "Pergunte ao usuário APENAS os campos faltantes ou inválidos listados.",
        missing_or_invalid: missing,
      },
    };
  }

  const proposedBill = {
    ...parsed.data,
    category_name: resolvedCategory?.name ?? "Categoria",
    recurring: Boolean(input.recurring),
  };

  // Never include bank details in what is echoed back to the LLM
  const safeEcho = {
    description: proposedBill.description,
    company: proposedBill.company,
    category_name: proposedBill.category_name,
    amount_cents: proposedBill.amount_cents,
    payment_type: proposedBill.payment_type,
    due_date: proposedBill.due_date,
    status: proposedBill.status,
    recurring: proposedBill.recurring,
  };

  return {
    toolOutput: {
      ok: true,
      status: "awaiting_user_confirmation",
      note: "Rascunho pronto. Informe ao usuário para conferir e confirmar no cartão abaixo. Nada foi salvo ainda.",
      draft: safeEcho,
    },
    proposedBill,
  };
}

export function runProposeIncomeTool(
  rawArgs: unknown,
  ctx: ToolContext,
): { toolOutput: unknown; proposedIncome?: unknown } {
  const input = (rawArgs && typeof rawArgs === "object" ? rawArgs : {}) as Record<string, unknown>;
  const types = ctx.incomeTypes ?? [];

  let resolvedType =
    typeof input.income_type_id === "string"
      ? types.find((t) => t.id === input.income_type_id)
      : undefined;

  if (!resolvedType && typeof input.income_type_name === "string") {
    const target = input.income_type_name.trim().toLowerCase();
    resolvedType = types.find((t) => t.name.trim().toLowerCase() === target);
  }

  const candidate = {
    description: typeof input.description === "string" ? input.description : "",
    amount_cents: typeof input.amount_cents === "number" ? input.amount_cents : Number.NaN,
    received_date: typeof input.received_date === "string" ? input.received_date : ctx.todayIso,
    nature: input.nature,
    income_type_id:
      resolvedType?.id ?? (typeof input.income_type_id === "string" ? input.income_type_id : ""),
    bank_id: null,
  };

  const parsed = incomeSchema.safeParse(candidate);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => ({
      field: String(issue.path[0] ?? "form"),
      message: issue.message,
    }));
    return {
      toolOutput: {
        ok: false,
        instruction: "Pergunte ao usuário APENAS os campos faltantes ou inválidos listados.",
        missing_or_invalid: missing,
      },
    };
  }

  const proposedIncome = {
    ...parsed.data,
    income_type_name: resolvedType?.name ?? "Renda",
  };

  return {
    toolOutput: {
      ok: true,
      status: "awaiting_user_confirmation",
      note: "Rascunho de renda pronto. Peça ao usuário para conferir e confirmar no cartão abaixo. Nada foi salvo ainda.",
      draft: proposedIncome,
    },
    proposedIncome,
  };
}

export async function executeChatTool(
  name: string,
  rawArguments: string,
  ctx: ToolContext,
): Promise<{ toolOutput: unknown; proposedBill?: unknown; proposedIncome?: unknown }> {
  let parsedArgs: unknown = {};
  if (rawArguments.trim()) {
    try {
      parsedArgs = JSON.parse(rawArguments);
    } catch {
      return { toolOutput: { error: "Argumentos JSON inválidos." } };
    }
  }

  try {
    if (name === "list_bills") {
      return { toolOutput: await runListBillsTool(parsedArgs, ctx) };
    }
    if (name === "spending_report") {
      return { toolOutput: await runSpendingReportTool(parsedArgs, ctx) };
    }
    if (name === "propose_bill") {
      return runProposeBillTool(parsedArgs, ctx);
    }
    if (name === "propose_income") {
      return runProposeIncomeTool(parsedArgs, ctx);
    }
    return { toolOutput: { error: `Ferramenta desconhecida: ${name}` } };
  } catch (error) {
    return {
      toolOutput: {
        error: error instanceof Error ? error.message : "Erro ao executar ferramenta.",
      },
    };
  }
}
