import type { ProposedBillDraft } from "@/features/chat/schemas/chatSchemas";

export interface SendChatResponse {
  reply: string;
  proposedBill?: ProposedBillDraft;
  usedFallback?: boolean;
}

export async function sendChatMessage(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  accessToken: string,
): Promise<SendChatResponse> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ messages }),
  });

  let data: { reply?: string; proposedBill?: ProposedBillDraft; usedFallback?: boolean; error?: string } = {};
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
    usedFallback: data.usedFallback,
  };
}
