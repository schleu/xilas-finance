import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  FRIENDLY_LLM_UNAVAILABLE_MESSAGE,
  LlmProviderError,
  createChatCompletion,
  listPublicLlmModels,
  type ChatCompletionOptions,
  type LlmCompletionResult,
  type LlmMessage,
  type LlmToolDefinition,
  type PublicLlmModelOption,
} from "./_llm/provider.js";
import { buildChatSystemPrompt, type PromptCategory, type PromptStore } from "./_llm/prompts.js";
import { SlidingWindowRateLimiter } from "./_llm/rateLimit.js";
import { CHAT_READ_TOOLS, executeChatTool } from "./_llm/tools.js";

export interface ChatHttpRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

export interface ChatHttpResponse {
  status(code: number): ChatHttpResponse;
  json(payload: unknown): void;
}

const chatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(2000),
      }),
    )
    .min(1)
    .max(20),
  modelId: z.string().trim().min(1).max(60).optional(),
});

export interface ChatToolExecutionResult {
  toolOutput: unknown;
  proposedBill?: unknown;
  proposedIncome?: unknown;
}

export type ChatToolExecutor = (
  name: string,
  rawArguments: string,
  ctx: {
    supabase: SupabaseClient;
    categories: PromptCategory[];
    stores?: PromptStore[];
    incomeTypes?: PromptCategory[];
    todayIso: string;
  },
) => Promise<ChatToolExecutionResult>;

export interface ChatHandlerDeps {
  createUserSupabase?: (jwt: string) => SupabaseClient;
  complete?: (options: ChatCompletionOptions) => Promise<LlmCompletionResult>;
  listModels?: () => PublicLlmModelOption[];
  rateLimiter?: SlidingWindowRateLimiter;
  tools?: LlmToolDefinition[];
  executeTool?: ChatToolExecutor;
  getTodayIso?: () => string;
}

const defaultRateLimiter = new SlidingWindowRateLimiter(
  Number(process.env.FINANCE_CHAT_RATE_LIMIT_MAX ?? 20),
  Number(process.env.FINANCE_CHAT_RATE_LIMIT_WINDOW_MS ?? 60 * 60 * 1000),
);

function todayIsoFortalezaServer(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function defaultCreateUserSupabase(jwt: string): SupabaseClient {
  const url = process.env.FINANCE_SUPABASE_URL ?? process.env.VITE_FINANCE_SUPABASE_URL;
  const anonKey =
    process.env.FINANCE_SUPABASE_ANON_KEY ?? process.env.VITE_FINANCE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("FINANCE_SUPABASE_URL e FINANCE_SUPABASE_ANON_KEY não configurados no servidor.");
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}

function extractBearerToken(headers: Record<string, string | string[] | undefined>): string | null {
  const raw = headers.authorization ?? headers.Authorization;
  const header = Array.isArray(raw) ? raw[0] : raw;
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
}

export function createChatHandler(deps: ChatHandlerDeps = {}) {
  const createUserSupabase = deps.createUserSupabase ?? defaultCreateUserSupabase;
  const complete = deps.complete ?? createChatCompletion;
  const listModels = deps.listModels ?? (() => listPublicLlmModels());
  const rateLimiter = deps.rateLimiter ?? defaultRateLimiter;
  const tools = deps.tools ?? CHAT_READ_TOOLS;
  const executeTool = deps.executeTool ?? executeChatTool;
  const getTodayIso = deps.getTodayIso ?? todayIsoFortalezaServer;

  return async function handler(req: ChatHttpRequest, res: ChatHttpResponse): Promise<void> {
    if (req.method !== "POST" && req.method !== "GET") {
      res.status(405).json({ error: "Método não permitido. Use GET ou POST." });
      return;
    }

    const jwt = extractBearerToken(req.headers);
    if (!jwt) {
      res.status(401).json({ error: "Sessão ausente. Faça login para usar o assistente." });
      return;
    }

    let supabase: SupabaseClient;
    try {
      supabase = createUserSupabase(jwt);
    } catch {
      res.status(500).json({ error: "Configuração do servidor incompleta." });
      return;
    }

    const { data: userData, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !userData.user) {
      res.status(401).json({ error: "Sessão inválida ou expirada. Faça login novamente." });
      return;
    }

    if (req.method === "GET") {
      res.status(200).json({ models: listModels() });
      return;
    }

    const limit = rateLimiter.check(userData.user.id);
    if (!limit.allowed) {
      res.status(429).json({
        error:
          "Você atingiu o limite de mensagens por hora. Tente novamente mais tarde ou use o app manualmente.",
      });
      return;
    }

    const parsedBody = chatRequestSchema.safeParse(req.body);
    if (!parsedBody.success) {
      res.status(400).json({ error: "Envie uma mensagem válida para o assistente." });
      return;
    }

    const { data: categoriesData } = await supabase
      .from("categories")
      .select("id, name")
      .order("name", { ascending: true });
    const categories = (categoriesData ?? []) as PromptCategory[];

    let stores: PromptStore[] = [];
    try {
      const { data: storesData } = await supabase
        .from("stores")
        .select("id, name, store_type")
        .order("name", { ascending: true });
      stores = (storesData ?? []) as PromptStore[];
    } catch {
      // Keep default empty stores list
    }

    let incomeTypes: PromptCategory[] = [];
    try {
      const { data: incomeTypesData } = await supabase
        .from("income_types")
        .select("id, name")
        .order("name", { ascending: true });
      incomeTypes = (incomeTypesData ?? []) as PromptCategory[];
    } catch {
      // Keep default empty incomeTypes list
    }

    const todayIso = getTodayIso();
    const modelId = parsedBody.data.modelId;
    const conversation: LlmMessage[] = [
      { role: "system", content: buildChatSystemPrompt(todayIso, categories, stores) },
      ...parsedBody.data.messages.slice(-12),
    ];

    try {
      let proposedBill: unknown = undefined;
      let proposedIncome: unknown = undefined;
      let completion = await complete({ messages: conversation, tools, modelId });

      if (completion.toolCalls.length > 0 && executeTool) {
        const assistantToolCalls = completion.toolCalls.map((call) => ({
          id: call.id,
          type: "function" as const,
          function: { name: call.name, arguments: call.arguments },
        }));

        conversation.push({
          role: "assistant",
          content: completion.content || null,
          tool_calls: assistantToolCalls,
        });

        for (const call of completion.toolCalls) {
          const toolResult = await executeTool(call.name, call.arguments, {
            supabase,
            categories,
            stores,
            incomeTypes,
            todayIso,
          });
          if (toolResult.proposedBill !== undefined) {
            proposedBill = toolResult.proposedBill;
          }
          if (toolResult.proposedIncome !== undefined) {
            proposedIncome = toolResult.proposedIncome;
          }
          conversation.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(toolResult.toolOutput),
          });
        }

        completion = await complete({ messages: conversation, tools, modelId });
      }

      res.status(200).json({
        reply: completion.content,
        proposedBill,
        proposedIncome,
        usedFallback: completion.usedFallback,
        modelId: modelId ?? "primary",
      });
    } catch (error) {
      const status = error instanceof LlmProviderError ? error.statusCode : 503;
      const message =
        error instanceof LlmProviderError ? error.message : FRIENDLY_LLM_UNAVAILABLE_MESSAGE;
      res.status(status).json({ error: message });
    }
  };
}

const defaultHandler = createChatHandler();
export default defaultHandler;
