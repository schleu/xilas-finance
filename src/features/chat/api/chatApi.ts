import type { ProposedBillDraft } from "@/features/chat/schemas/chatSchemas";

export interface ChatModelOption {
  id: string;
  label: string;
  isDefault: boolean;
}

export interface SendChatResponse {
  reply: string;
  proposedBill?: ProposedBillDraft;
  proposedIncome?: Record<string, unknown>;
  usedFallback?: boolean;
  modelId?: string;
}

export function getChatEdgeFunctionUrl(): string {
  const supabaseUrl = (import.meta.env.VITE_FINANCE_SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
  if (!supabaseUrl) {
    throw new Error("Defina VITE_FINANCE_SUPABASE_URL para conectar ao assistente.");
  }
  return `${supabaseUrl}/functions/v1/chat`;
}

function buildEdgeHeaders(accessToken: string, includeJson = false): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };
  const anonKey = (import.meta.env.VITE_FINANCE_SUPABASE_ANON_KEY ?? "").trim();
  if (anonKey) {
    headers.apikey = anonKey;
  }
  if (includeJson) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
}

export async function fetchChatModels(accessToken: string): Promise<ChatModelOption[]> {
  let url: string;
  try {
    url = getChatEdgeFunctionUrl();
  } catch {
    return [];
  }

  const response = await fetch(url, {
    method: "GET",
    headers: buildEdgeHeaders(accessToken),
  });
  if (!response.ok) return [];
  try {
    const data = (await response.json()) as { models?: ChatModelOption[] };
    return Array.isArray(data.models) ? data.models : [];
  } catch {
    return [];
  }
}

export async function sendChatMessage(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  accessToken: string,
  modelId?: string,
): Promise<SendChatResponse> {
  const response = await fetch(getChatEdgeFunctionUrl(), {
    method: "POST",
    headers: buildEdgeHeaders(accessToken, true),
    body: JSON.stringify(modelId ? { messages, modelId } : { messages }),
  });

  let data: {
    reply?: string;
    proposedBill?: ProposedBillDraft;
    proposedIncome?: Record<string, unknown>;
    usedFallback?: boolean;
    modelId?: string;
    error?: string;
  } = {};
  try {
    data = (await response.json()) as typeof data;
  } catch {
    // Non-JSON error body
  }

  if (!response.ok) {
    throw new Error(
      data.error ??
        "O assistente está temporariamente indisponível. Você pode continuar usando o app manualmente.",
    );
  }

  return {
    reply: data.reply ?? "",
    proposedBill: data.proposedBill,
    proposedIncome: data.proposedIncome,
    usedFallback: data.usedFallback,
    modelId: data.modelId,
  };
}
