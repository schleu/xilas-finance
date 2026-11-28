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

export async function fetchChatModels(accessToken: string): Promise<ChatModelOption[]> {
  const response = await fetch("/api/chat", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
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
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
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
