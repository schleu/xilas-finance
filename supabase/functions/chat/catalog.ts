export interface EdgeLlmProviderConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
}

export interface EdgeLlmCatalogEntry {
  id: string;
  label: string;
  config: EdgeLlmProviderConfig;
  isDefault: boolean;
}

export interface EdgePublicModelOption {
  id: string;
  label: string;
  isDefault: boolean;
}

export interface EdgeLlmToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface EdgeLlmToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface EdgeRawToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export type EdgeLlmMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: EdgeRawToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export interface EdgeLlmCompletionResult {
  content: string;
  toolCalls: EdgeLlmToolCall[];
  providerModel: string;
  usedFallback: boolean;
}

export class EdgeLlmProviderError extends Error {
  readonly statusCode: number;
  readonly retryable: boolean;

  constructor(message: string, statusCode = 503, retryable = false) {
    super(message);
    this.name = "EdgeLlmProviderError";
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

export const EDGE_FRIENDLY_LLM_UNAVAILABLE_MESSAGE =
  "O assistente está temporariamente indisponível. Você pode continuar usando o app normalmente de forma manual.";

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export const DEFAULT_OPENROUTER_FREE_MODELS: ReadonlyArray<{
  id: string;
  label: string;
  isDefault?: boolean;
}> = [
  { id: "openrouter/free", label: "OpenRouter Free (Auto)", isDefault: true },
  { id: "google/gemma-4-31b-it:free", label: "Gemma 4 31B (Free)" },
  { id: "google/gemma-4-26b-a4b-it:free", label: "Gemma 4 26B A4B (Free)" },
  { id: "inclusionai/ling-3.2-flash:free", label: "Ling 3.2 Flash (Free)" },
  { id: "nvidia/nemotron-3.5-super-vl:free", label: "Nemotron 3.5 Super VL (Free)" },
  { id: "baidu/ernie-5.5-flash-preview:free", label: "ERNIE 5.5 Flash (Free)" },
  { id: "nvidia/nemotron-3.5-lightning:free", label: "Nemotron 3.5 Lightning (Free)" },
];

export function loadEdgeLlmCatalog(env: Record<string, string | undefined>): EdgeLlmCatalogEntry[] {
  const rawModels = env.FINANCE_LLM_MODELS?.trim();
  if (rawModels) {
    try {
      const parsed = JSON.parse(rawModels) as Array<{
        id?: unknown;
        label?: unknown;
        baseUrl?: unknown;
        model?: unknown;
        apiKey?: unknown;
        isDefault?: unknown;
      }>;
      if (Array.isArray(parsed) && parsed.length > 0) {
        const valid = parsed.filter(
          (item) =>
            typeof item.id === "string" &&
            item.id.trim().length > 0 &&
            typeof item.label === "string" &&
            item.label.trim().length > 0 &&
            typeof item.baseUrl === "string" &&
            item.baseUrl.trim().length > 0 &&
            typeof item.model === "string" &&
            item.model.trim().length > 0 &&
            typeof item.apiKey === "string" &&
            item.apiKey.trim().length > 0,
        );
        if (valid.length > 0) {
          const hasExplicitDefault = valid.some((item) => Boolean(item.isDefault));
          return valid.map((item, idx) => ({
            id: String(item.id).trim(),
            label: String(item.label).trim(),
            config: {
              baseUrl: String(item.baseUrl).trim(),
              model: String(item.model).trim(),
              apiKey: String(item.apiKey).trim(),
            },
            isDefault: hasExplicitDefault ? Boolean(item.isDefault) : idx === 0,
          }));
        }
      }
    } catch {
      // Fall through to OPENROUTER_API_KEY default catalog
    }
  }

  const openRouterKey = (
    env.OPENROUTER_API_KEY ??
    env.FINANCE_LLM_OPENROUTER_API_KEY ??
    env.FINANCE_LLM_PRIMARY_API_KEY
  )?.trim();

  if (!openRouterKey) {
    return [];
  }

  const baseUrl = env.OPENROUTER_BASE_URL?.trim() || OPENROUTER_BASE_URL;
  return DEFAULT_OPENROUTER_FREE_MODELS.map((m, idx) => ({
    id: m.id,
    label: m.label,
    config: { baseUrl, model: m.id, apiKey: openRouterKey },
    isDefault: m.isDefault ?? idx === 0,
  }));
}

export function listEdgePublicModels(
  env: Record<string, string | undefined>,
): EdgePublicModelOption[] {
  return loadEdgeLlmCatalog(env).map(({ id, label, isDefault }) => ({
    id,
    label,
    isDefault,
  }));
}

export function resolveModelAttemptOrder(
  env: Record<string, string | undefined>,
  requestedModelId?: string,
): { attempts: EdgeLlmCatalogEntry[]; selectedModelId: string } {
  const catalog = loadEdgeLlmCatalog(env);
  if (catalog.length === 0) {
    throw new EdgeLlmProviderError(EDGE_FRIENDLY_LLM_UNAVAILABLE_MESSAGE, 503, false);
  }

  let selected: EdgeLlmCatalogEntry | undefined;
  if (requestedModelId) {
    selected = catalog.find((item) => item.id === requestedModelId);
    if (!selected) {
      throw new EdgeLlmProviderError("Modelo de LLM selecionado não está disponível.", 400, false);
    }
  } else {
    selected = catalog.find((item) => item.isDefault) ?? catalog[0]!;
  }

  const fallbacks = catalog.filter((item) => item.id !== selected.id);
  return {
    attempts: [selected, ...fallbacks],
    selectedModelId: selected.id,
  };
}

export function extractJsonFallbackToolCall(content: string): EdgeLlmToolCall | null {
  const fencedMatch = /```(?:json)?\s*([\s\S]*?)```/i.exec(content);
  const candidate = (fencedMatch?.[1] ?? content).trim();
  if (!candidate.startsWith("{") || !candidate.endsWith("}")) {
    return null;
  }
  try {
    const parsed = JSON.parse(candidate) as { tool?: unknown; arguments?: unknown };
    if (
      typeof parsed.tool === "string" &&
      parsed.arguments &&
      typeof parsed.arguments === "object"
    ) {
      return {
        id: "json-fallback-call",
        name: parsed.tool,
        arguments: JSON.stringify(parsed.arguments),
      };
    }
  } catch {
    return null;
  }
  return null;
}

interface OpenAiResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: EdgeRawToolCall[];
    };
  }>;
}

async function callProviderOnce(
  config: EdgeLlmProviderConfig,
  messages: EdgeLlmMessage[],
  tools: EdgeLlmToolDefinition[] | undefined,
  fetchFn: typeof fetch,
  timeoutMs: number,
): Promise<{ content: string; toolCalls: EdgeLlmToolCall[] }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const endpoint = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
    const body: Record<string, unknown> = {
      model: config.model,
      messages,
      temperature: 0.2,
    };
    if (tools && tools.length > 0) {
      body.tools = tools;
      body.tool_choice = "auto";
    }

    const response = await fetchFn(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
        "HTTP-Referer": "https://xilas-finance.vercel.app",
        "X-Title": "Xilas Finance",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (response.status === 429 || response.status >= 500) {
      throw new EdgeLlmProviderError(EDGE_FRIENDLY_LLM_UNAVAILABLE_MESSAGE, response.status, true);
    }

    if (!response.ok) {
      throw new EdgeLlmProviderError(EDGE_FRIENDLY_LLM_UNAVAILABLE_MESSAGE, response.status, false);
    }

    const json = (await response.json()) as OpenAiResponse;
    const message = json.choices?.[0]?.message;
    const content = message?.content ?? "";
    const nativeToolCalls: EdgeLlmToolCall[] = (message?.tool_calls ?? []).map((call) => ({
      id: call.id,
      name: call.function.name,
      arguments: call.function.arguments,
    }));

    if (nativeToolCalls.length > 0) {
      return { content, toolCalls: nativeToolCalls };
    }

    const fallbackCall = tools && tools.length > 0 ? extractJsonFallbackToolCall(content) : null;
    if (fallbackCall) {
      return { content: "", toolCalls: [fallbackCall] };
    }

    return { content, toolCalls: [] };
  } catch (error) {
    if (error instanceof EdgeLlmProviderError) {
      throw error;
    }
    throw new EdgeLlmProviderError(EDGE_FRIENDLY_LLM_UNAVAILABLE_MESSAGE, 504, true);
  } finally {
    clearTimeout(timer);
  }
}

export async function createEdgeChatCompletion(options: {
  messages: EdgeLlmMessage[];
  tools?: EdgeLlmToolDefinition[];
  modelId?: string;
  env: Record<string, string | undefined>;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}): Promise<EdgeLlmCompletionResult> {
  const { messages, tools, modelId, env, fetchFn = fetch, timeoutMs = 15_000 } = options;
  const { attempts } = resolveModelAttemptOrder(env, modelId);

  for (let i = 0; i < attempts.length; i += 1) {
    const entry = attempts[i]!;
    try {
      const result = await callProviderOnce(entry.config, messages, tools, fetchFn, timeoutMs);
      return {
        ...result,
        providerModel: entry.config.model,
        usedFallback: i > 0,
      };
    } catch (error) {
      const retryable = error instanceof EdgeLlmProviderError && error.retryable;
      if (!retryable || i === attempts.length - 1) {
        throw new EdgeLlmProviderError(EDGE_FRIENDLY_LLM_UNAVAILABLE_MESSAGE, 503, false);
      }
    }
  }

  throw new EdgeLlmProviderError(EDGE_FRIENDLY_LLM_UNAVAILABLE_MESSAGE, 503, false);
}
