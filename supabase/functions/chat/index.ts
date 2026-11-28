// Supabase Edge Function: chat (Spec 008)
// Runs on Deno runtime in Supabase Edge Functions.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  EDGE_FRIENDLY_LLM_UNAVAILABLE_MESSAGE,
  EdgeLlmProviderError,
  createEdgeChatCompletion,
  listEdgePublicModels,
  type EdgeLlmMessage,
  type EdgeLlmToolDefinition,
} from "./catalog.ts";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
    toObject(): Record<string, string>;
  };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SAFE_BILL_COLUMNS =
  "id, description, company, category_id, amount_cents, payment_type, due_date, status, paid_at, recurring_rule_id, categories(name)";

const CHAT_TOOLS: EdgeLlmToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "list_bills",
      description:
        "Lista despesas reais do usuário autenticado (sem dados bancários), com filtros opcionais por período, status e categoria.",
      parameters: {
        type: "object",
        properties: {
          from: { type: "string", description: "Data inicial (YYYY-MM-DD)" },
          to: { type: "string", description: "Data final (YYYY-MM-DD)" },
          status: { type: "string", enum: ["all", "pending", "paid", "overdue"] },
          category_name: { type: "string", description: "Nome da categoria" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "spending_report",
      description:
        "Gera relatório de gastos pagos por categoria no período (padrão: mês atual), citando pendentes à parte.",
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
        "Monta um rascunho validado de despesa para confirmação explícita do usuário na interface. NUNCA grava no banco.",
      parameters: {
        type: "object",
        properties: {
          description: { type: "string" },
          company: { type: "string" },
          category_id: { type: "string" },
          category_name: { type: "string" },
          amount_cents: { type: "integer" },
          payment_type: { type: "string", enum: ["pix", "credit", "debit"] },
          due_date: { type: "string", description: "YYYY-MM-DD" },
          status: { type: "string", enum: ["pending", "paid"] },
          paid_at: { type: "string" },
          recurring: { type: "boolean" },
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
          description: { type: "string" },
          amount_cents: { type: "integer" },
          received_date: { type: "string", description: "YYYY-MM-DD" },
          nature: { type: "string", enum: ["fixed", "variable"] },
          income_type_id: { type: "string" },
          income_type_name: { type: "string" },
        },
      },
    },
  },
];

const rateLimitBuckets = new Map<string, number[]>();

function checkRateLimit(userId: string, maxRequests = 20, windowMs = 60 * 60 * 1000): boolean {
  const now = Date.now();
  const timestamps = (rateLimitBuckets.get(userId) ?? []).filter((ts) => now - ts < windowMs);
  if (timestamps.length >= maxRequests) {
    rateLimitBuckets.set(userId, timestamps);
    return false;
  }
  timestamps.push(now);
  rateLimitBuckets.set(userId, timestamps);
  return true;
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8" },
  });
}

function todayIsoFortaleza(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function monthRange(month: string): { from: string; to: string } {
  const [yStr, mStr] = month.split("-");
  const year = Number(yStr);
  const m = Number(mStr);
  const lastDay = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

interface PromptItem {
  id: string;
  name: string;
}

function buildSystemPrompt(
  todayIso: string,
  categories: PromptItem[],
  stores: PromptItem[],
): string {
  const catList =
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
    catList,
    "Lojas cadastradas do usuário:",
    storeList,
    "Regras obrigatórias:",
    "1. Nunca invente despesas, datas ou valores: use apenas dados retornados pelas ferramentas.",
    "2. Nunca peça nem repita dados bancários sensíveis (banco, agência, conta).",
    "3. Para cadastrar uma despesa ou renda, use propose_bill ou propose_income. Elas NÃO gravam no banco: apenas montam um rascunho para o usuário confirmar.",
    "4. Se faltar algum campo obrigatório, pergunte APENAS o que falta.",
    "5. Para consultar despesas use list_bills; para relatório por categoria use spending_report.",
  ].join("\n");
}

async function runTool(
  name: string,
  rawArgs: string,
  ctx: {
    supabase: SupabaseClient;
    categories: PromptItem[];
    stores: PromptItem[];
    incomeTypes: PromptItem[];
    todayIso: string;
  },
): Promise<{ toolOutput: unknown; proposedBill?: unknown; proposedIncome?: unknown }> {
  let args: Record<string, unknown> = {};
  if (rawArgs.trim()) {
    try {
      args = JSON.parse(rawArgs) as Record<string, unknown>;
    } catch {
      return { toolOutput: { error: "Argumentos JSON inválidos." } };
    }
  }

  if (name === "list_bills") {
    let query = ctx.supabase
      .from("bills")
      .select(SAFE_BILL_COLUMNS)
      .order("due_date", { ascending: true })
      .limit(50);

    if (typeof args.from === "string") query = query.gte("due_date", args.from);
    if (typeof args.to === "string") query = query.lte("due_date", args.to);
    if (args.status === "pending" || args.status === "paid") {
      query = query.eq("status", args.status);
    } else if (args.status === "overdue") {
      query = query.eq("status", "pending").lt("due_date", ctx.todayIso);
    }
    if (typeof args.category_name === "string") {
      const target = args.category_name.trim().toLowerCase();
      const matched = ctx.categories.find((c) => c.name.trim().toLowerCase() === target);
      if (matched) query = query.eq("category_id", matched.id);
    }

    const { data, error } = await query;
    if (error) return { toolOutput: { error: "Não foi possível consultar suas despesas." } };
    return { toolOutput: { bills: data ?? [], count: (data ?? []).length } };
  }

  if (name === "spending_report") {
    const def = monthRange(ctx.todayIso.slice(0, 7));
    const from = typeof args.from === "string" ? args.from : def.from;
    const to = typeof args.to === "string" ? args.to : def.to;
    const { data: catRows, error } = await ctx.supabase.rpc("spending_by_category", {
      p_from: from,
      p_to: to,
    });
    if (error) return { toolOutput: { error: "Não foi possível gerar o relatório." } };
    return { toolOutput: { from, to, by_category: catRows ?? [] } };
  }

  if (name === "propose_bill") {
    const catName = typeof args.category_name === "string" ? args.category_name.trim().toLowerCase() : "";
    const resolvedCategory =
      ctx.categories.find((c) => c.id === args.category_id) ??
      ctx.categories.find((c) => c.name.trim().toLowerCase() === catName);
    const description = typeof args.description === "string" ? args.description.trim() : "";
    const amountCents = typeof args.amount_cents === "number" ? Math.round(args.amount_cents) : 0;
    const dueDate = typeof args.due_date === "string" ? args.due_date : ctx.todayIso;
    const paymentType =
      args.payment_type === "pix" || args.payment_type === "credit" || args.payment_type === "debit"
        ? args.payment_type
        : null;

    if (!description || !resolvedCategory || amountCents <= 0 || !paymentType) {
      return {
        toolOutput: {
          ok: false,
          instruction: "Pergunte ao usuário os campos faltantes: descrição, categoria, valor e tipo de pagamento.",
        },
      };
    }

    const proposedBill = {
      description,
      company: typeof args.company === "string" ? args.company.trim() || null : null,
      category_id: resolvedCategory.id,
      category_name: resolvedCategory.name,
      amount_cents: amountCents,
      payment_type: paymentType,
      bank: null,
      agency: null,
      account_number: null,
      due_date: dueDate,
      status: args.status === "paid" ? "paid" : "pending",
      paid_at: args.status === "paid" ? (typeof args.paid_at === "string" ? args.paid_at : ctx.todayIso) : null,
      recurring: Boolean(args.recurring),
    };

    return {
      toolOutput: {
        ok: true,
        status: "awaiting_user_confirmation",
        note: "Rascunho pronto. Peça ao usuário para conferir e confirmar no cartão abaixo.",
        draft: proposedBill,
      },
      proposedBill,
    };
  }

  if (name === "propose_income") {
    const typeName =
      typeof args.income_type_name === "string" ? args.income_type_name.trim().toLowerCase() : "";
    const resolvedType =
      ctx.incomeTypes.find((t) => t.id === args.income_type_id) ??
      ctx.incomeTypes.find((t) => t.name.trim().toLowerCase() === typeName);
    const description = typeof args.description === "string" ? args.description.trim() : "";
    const amountCents = typeof args.amount_cents === "number" ? Math.round(args.amount_cents) : 0;
    const nature = args.nature === "fixed" || args.nature === "variable" ? args.nature : null;

    if (!description || !resolvedType || amountCents <= 0 || !nature) {
      return {
        toolOutput: {
          ok: false,
          instruction: "Pergunte ao usuário os campos faltantes: descrição, valor, natureza (fixa/variável) e tipo de renda.",
        },
      };
    }

    const proposedIncome = {
      description,
      amount_cents: amountCents,
      received_date: typeof args.received_date === "string" ? args.received_date : ctx.todayIso,
      nature,
      income_type_id: resolvedType.id,
      income_type_name: resolvedType.name,
      bank_id: null,
    };

    return {
      toolOutput: {
        ok: true,
        status: "awaiting_user_confirmation",
        note: "Rascunho de renda pronto. Peça ao usuário para conferir e confirmar.",
        draft: proposedIncome,
      },
      proposedIncome,
    };
  }

  return { toolOutput: { error: `Ferramenta desconhecida: ${name}` } };
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido. Use GET ou POST." }, 405);
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  const jwt = match?.[1]?.trim();
  if (!jwt) {
    return jsonResponse({ error: "Sessão ausente. Faça login para usar o assistente." }, 401);
  }

  const env = Deno.env.toObject();
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseAnonKey = env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse({ error: "Configuração do servidor incompleta." }, 500);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const { data: userData, error: authError } = await supabase.auth.getUser(jwt);
  if (authError || !userData.user) {
    return jsonResponse({ error: "Sessão inválida ou expirada. Faça login novamente." }, 401);
  }

  if (req.method === "GET") {
    return jsonResponse({ models: listEdgePublicModels(env) }, 200);
  }

  const maxReq = Number(env.FINANCE_CHAT_RATE_LIMIT_MAX ?? 20);
  const windowMs = Number(env.FINANCE_CHAT_RATE_LIMIT_WINDOW_MS ?? 60 * 60 * 1000);
  if (!checkRateLimit(userData.user.id, maxReq, windowMs)) {
    return jsonResponse(
      {
        error:
          "Você atingiu o limite de mensagens por hora. Tente novamente mais tarde ou use o app manualmente.",
      },
      429,
    );
  }

  let body: { messages?: Array<{ role: "user" | "assistant"; content: string }>; modelId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return jsonResponse({ error: "Envie uma mensagem válida para o assistente." }, 400);
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0 || messages.length > 20) {
    return jsonResponse({ error: "Envie uma mensagem válida para o assistente." }, 400);
  }

  const [{ data: categoriesData }, { data: storesData }, { data: incomeTypesData }] =
    await Promise.all([
      supabase.from("categories").select("id, name").order("name", { ascending: true }),
      supabase.from("stores").select("id, name").order("name", { ascending: true }),
      supabase.from("income_types").select("id, name").order("name", { ascending: true }),
    ]);

  const categories = (categoriesData ?? []) as PromptItem[];
  const stores = (storesData ?? []) as PromptItem[];
  const incomeTypes = (incomeTypesData ?? []) as PromptItem[];
  const todayIso = todayIsoFortaleza();

  const conversation: EdgeLlmMessage[] = [
    { role: "system", content: buildSystemPrompt(todayIso, categories, stores) },
    ...messages.slice(-12),
  ];

  try {
    let proposedBill: unknown = undefined;
    let proposedIncome: unknown = undefined;

    let completion = await createEdgeChatCompletion({
      messages: conversation,
      tools: CHAT_TOOLS,
      modelId: body.modelId,
      env,
    });

    if (completion.toolCalls.length > 0) {
      conversation.push({
        role: "assistant",
        content: completion.content || null,
        tool_calls: completion.toolCalls.map((call) => ({
          id: call.id,
          type: "function" as const,
          function: { name: call.name, arguments: call.arguments },
        })),
      });

      for (const call of completion.toolCalls) {
        const result = await runTool(call.name, call.arguments, {
          supabase,
          categories,
          stores,
          incomeTypes,
          todayIso,
        });
        if (result.proposedBill !== undefined) proposedBill = result.proposedBill;
        if (result.proposedIncome !== undefined) proposedIncome = result.proposedIncome;
        conversation.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result.toolOutput),
        });
      }

      completion = await createEdgeChatCompletion({
        messages: conversation,
        tools: CHAT_TOOLS,
        modelId: body.modelId,
        env,
      });
    }

    return jsonResponse(
      {
        reply: completion.content,
        proposedBill,
        proposedIncome,
        usedFallback: completion.usedFallback,
        modelId: completion.providerModel,
      },
      200,
    );
  } catch (error) {
    const status = error instanceof EdgeLlmProviderError ? error.statusCode : 503;
    const message =
      error instanceof EdgeLlmProviderError ? error.message : EDGE_FRIENDLY_LLM_UNAVAILABLE_MESSAGE;
    return jsonResponse({ error: message }, status);
  }
});
