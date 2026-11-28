import { z } from "zod";

export interface LlmProviderConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
}

export interface LlmCatalogEntry {
  id: string;
  label: string;
  config: LlmProviderConfig;
  isDefault: boolean;
}

export interface PublicLlmModelOption {
  id: string;
  label: string;
  isDefault: boolean;
}

const catalogEntrySchema = z.object({
  id: z.string().trim().min(1).max(60),
  label: z.string().trim().min(1).max(80),
  baseUrl: z.string().trim().url(),
  model: z.string().trim().min(1),
  apiKey: z.string().trim().min(1),
  isDefault: z.boolean().optional(),
});

export interface LlmToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface LlmToolCall {
  id: string;
  name: string;
  arguments: string;
}

export type LlmMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: RawOpenAiToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

interface RawOpenAiToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAiChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: RawOpenAiToolCall[];
    };
  }>;
}

export interface LlmCompletionResult {
  content: string;
  toolCalls: LlmToolCall[];
  providerModel: string;
  usedFallback: boolean;
}

export class LlmProviderError extends Error {
  readonly statusCode: number;
  readonly retryable: boolean;

  constructor(message: string, statusCode = 503, retryable = false) {
    super(message);
    this.name = "LlmProviderError";
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

export const FRIENDLY_LLM_UNAVAILABLE_MESSAGE =
  "O assistente está temporariamente indisponível. Você pode continuar usando o app normalmente de forma manual.";

export function loadLlmCatalogFromEnv(
  env: Record<string, string | undefined> = process.env,
): LlmCatalogEntry[] {
  const rawModels = env.FINANCE_LLM_MODELS?.trim();
  if (rawModels) {
    try {
      const parsed = z.array(catalogEntrySchema).min(1).safeParse(JSON.parse(rawModels));
      if (parsed.success) {
        const hasExplicitDefault = parsed.data.some((item) => item.isDefault);
        return parsed.data.map((item, idx) => ({
          id: item.id,
          label: item.label,
          config: { baseUrl: item.baseUrl, model: item.model, apiKey: item.apiKey },
          isDefault: hasExplicitDefault ? Boolean(item.isDefault) : idx === 0,
        }));
      }
    } catch {
      // Fallback to PRIMARY/FALLBACK env vars
    }
  }

  const primaryBaseUrl = env.FINANCE_LLM_PRIMARY_BASE_URL?.trim();
  const primaryModel = env.FINANCE_LLM_PRIMARY_MODEL?.trim();
  const primaryApiKey = env.FINANCE_LLM_PRIMARY_API_KEY?.trim();

  if (!primaryBaseUrl || !primaryModel || !primaryApiKey) {
    return [];
  }

  const entries: LlmCatalogEntry[] = [
    {
      id: "primary",
      label: `Padrão (${primaryModel})`,
      config: { baseUrl: primaryBaseUrl, model: primaryModel, apiKey: primaryApiKey },
      isDefault: true,
    },
  ];

  const fallbackBaseUrl = env.FINANCE_LLM_FALLBACK_BASE_URL?.trim();
  const fallbackModel = env.FINANCE_LLM_FALLBACK_MODEL?.trim();
  const fallbackApiKey = env.FINANCE_LLM_FALLBACK_API_KEY?.trim();

  if (fallbackBaseUrl && fallbackModel && fallbackApiKey) {
    entries.push({
      id: "fallback",
      label: `Reserva (${fallbackModel})`,
      config: { baseUrl: fallbackBaseUrl, model: fallbackModel, apiKey: fallbackApiKey },
      isDefault: false,
    });
  }

  return entries;
}

export function listPublicLlmModels(
  env: Record<string, string | undefined> = process.env,
): PublicLlmModelOption[] {
  return loadLlmCatalogFromEnv(env).map(({ id, label, isDefault }) => ({
    id,
    label,
    isDefault,
  }));
}

export function loadLlmConfigsFromEnv(
  env: Record<string, string | undefined> = process.env,
  requestedModelId?: string,
): { primary: LlmProviderConfig; fallback: LlmProviderConfig | null; selectedModelId: string } {
  const catalog = loadLlmCatalogFromEnv(env);
  if (catalog.length === 0) {
    throw new LlmProviderError(FRIENDLY_LLM_UNAVAILABLE_MESSAGE, 503, false);
  }

  let selected: LlmCatalogEntry | undefined;
  if (requestedModelId) {
    selected = catalog.find((item) => item.id === requestedModelId);
    if (!selected) {
      throw new LlmProviderError("Modelo de LLM selecionado não está disponível.", 400, false);
    }
  } else {
    selected = catalog.find((item) => item.isDefault) ?? catalog[0]!;
  }

  const fallbackEntry = catalog.find((item) => item.id !== selected.id) ?? null;

  return {
    primary: selected.config,
    fallback: fallbackEntry?.config ?? null,
    selectedModelId: selected.id,
  };
}

/**
 * Fallback parser for free models that emit a JSON tool call inside text content
 * instead of using native `message.tool_calls` (see specs/001-core/research-llm.md).
 */
export function extractJsonFallbackToolCall(content: string): LlmToolCall | null {
  const fencedMatch = /```(?:json)?\s*([\s\S]*?)```/i.exec(content);
  const candidate = (fencedMatch?.[1] ?? content).trim();
  if (!candidate.startsWith("{") || !candidate.endsWith("}")) {
    return null;
  }
  try {
    const parsed = JSON.parse(candidate) as { tool?: unknown; arguments?: unknown };
    if (typeof parsed.tool === "string" && parsed.arguments && typeof parsed.arguments === "object") {
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

async function callSingleProvider(
  config: LlmProviderConfig,
  messages: LlmMessage[],
  tools: LlmToolDefinition[] | undefined,
  fetchFn: typeof fetch,
  timeoutMs: number,
): Promise<{ content: string; toolCalls: LlmToolCall[] }> {
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
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (response.status === 429 || response.status >= 500) {
      throw new LlmProviderError(FRIENDLY_LLM_UNAVAILABLE_MESSAGE, response.status, true);
    }

    if (!response.ok) {
      throw new LlmProviderError(FRIENDLY_LLM_UNAVAILABLE_MESSAGE, response.status, false);
    }

    const json = (await response.json()) as OpenAiChatCompletionResponse;
    const message = json.choices?.[0]?.message;
    const content = message?.content ?? "";
    const nativeToolCalls: LlmToolCall[] = (message?.tool_calls ?? []).map((call) => ({
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
    if (error instanceof LlmProviderError) {
      throw error;
    }
    // Network errors and AbortError (timeout) are retryable via fallback
    throw new LlmProviderError(FRIENDLY_LLM_UNAVAILABLE_MESSAGE, 504, true);
  } finally {
    clearTimeout(timer);
  }
}

export interface ChatCompletionOptions {
  messages: LlmMessage[];
  tools?: LlmToolDefinition[];
  modelId?: string;
  env?: Record<string, string | undefined>;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

export async function createChatCompletion({
  messages,
  tools,
  modelId,
  env = process.env,
  fetchFn = fetch,
  timeoutMs = 15_000,
}: ChatCompletionOptions): Promise<LlmCompletionResult> {
  const { primary, fallback } = loadLlmConfigsFromEnv(env, modelId);

  try {
    const result = await callSingleProvider(primary, messages, tools, fetchFn, timeoutMs);
    return {
      ...result,
      providerModel: primary.model,
      usedFallback: false,
    };
  } catch (error) {
    if (error instanceof LlmProviderError && error.retryable && fallback) {
      try {
        const result = await callSingleProvider(fallback, messages, tools, fetchFn, timeoutMs);
        return {
          ...result,
          providerModel: fallback.model,
          usedFallback: true,
        };
      } catch {
        throw new LlmProviderError(FRIENDLY_LLM_UNAVAILABLE_MESSAGE, 503, false);
      }
    }

    throw new LlmProviderError(FRIENDLY_LLM_UNAVAILABLE_MESSAGE, 503, false);
  }
}
