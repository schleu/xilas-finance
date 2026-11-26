import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { monthRange } from "../../src/lib/dates";
import type { LlmToolDefinition } from "./provider";
import type { PromptCategory } from "./prompts";

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
];

export interface ToolContext {
  supabase: SupabaseClient;
  categories: PromptCategory[];
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

export async function executeChatTool(
  name: string,
  rawArguments: string,
  ctx: ToolContext,
): Promise<{ toolOutput: unknown; proposedBill?: unknown }> {
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
    return { toolOutput: { error: `Ferramenta desconhecida: ${name}` } };
  } catch (error) {
    return {
      toolOutput: {
        error: error instanceof Error ? error.message : "Erro ao executar ferramenta.",
      },
    };
  }
}
