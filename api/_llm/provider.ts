export interface LlmProviderConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
}

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

export function loadLlmConfigsFromEnv(
  env: Record<string, string | undefined> = process.env,
): { primary: LlmProviderConfig; fallback: LlmProviderConfig | null } {
  const primaryBaseUrl = env.LLM_PRIMARY_BASE_URL?.trim();
  const primaryModel = env.LLM_PRIMARY_MODEL?.trim();
  const primaryApiKey = env.LLM_PRIMARY_API_KEY?.trim();

  if (!primaryBaseUrl || !primaryModel || !primaryApiKey) {
    throw new LlmProviderError(FRIENDLY_LLM_UNAVAILABLE_MESSAGE, 503, false);
  }

  const fallbackBaseUrl = env.LLM_FALLBACK_BASE_URL?.trim();
  const fallbackModel = env.LLM_FALLBACK_MODEL?.trim();
  const fallbackApiKey = env.LLM_FALLBACK_API_KEY?.trim();

  const fallback =
    fallbackBaseUrl && fallbackModel && fallbackApiKey
      ? { baseUrl: fallbackBaseUrl, model: fallbackModel, apiKey: fallbackApiKey }
      : null;

  return {
    primary: { baseUrl: primaryBaseUrl, model: primaryModel, apiKey: primaryApiKey },
    fallback,
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
  env?: Record<string, string | undefined>;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

export async function createChatCompletion({
  messages,
  tools,
  env = process.env,
  fetchFn = fetch,
  timeoutMs = 15_000,
}: ChatCompletionOptions): Promise<LlmCompletionResult> {
  const { primary, fallback } = loadLlmConfigsFromEnv(env);

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
