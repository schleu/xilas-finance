import type { ProposedBillDraft } from "@/features/chat/schemas/chatSchemas";
import { getSupabase } from "@/lib/supabase";

export interface ChatConversationRecord {
  id: string;
  user_id: string;
  title: string;
  conversation_date: string;
  model_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageRecord {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  model_id: string | null;
  used_fallback: boolean;
  proposed_bill: ProposedBillDraft | null;
  created_at: string;
}

export async function getTodayConversation(
  todayIso: string,
): Promise<ChatConversationRecord | null> {
  const { data, error } = await getSupabase()
    .from("chat_conversations")
    .select("id, user_id, title, conversation_date, model_id, created_at, updated_at")
    .eq("conversation_date", todayIso)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  const rows = (data ?? []) as ChatConversationRecord[];
  return rows[0] ?? null;
}

export async function listConversations(): Promise<ChatConversationRecord[]> {
  const { data, error } = await getSupabase()
    .from("chat_conversations")
    .select("id, user_id, title, conversation_date, model_id, created_at, updated_at")
    .order("conversation_date", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as ChatConversationRecord[];
}

export async function listConversationMessages(
  conversationId: string,
): Promise<ChatMessageRecord[]> {
  const { data, error } = await getSupabase()
    .from("chat_messages")
    .select("id, conversation_id, role, content, model_id, used_fallback, proposed_bill, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ChatMessageRecord[];
}

export async function createConversation(input: {
  title: string;
  conversation_date: string;
  model_id?: string | null;
}): Promise<ChatConversationRecord> {
  const trimmedTitle = input.title.trim().slice(0, 60) || "Nova conversa";
  const { data, error } = await getSupabase()
    .from("chat_conversations")
    .insert({
      title: trimmedTitle,
      conversation_date: input.conversation_date,
      model_id: input.model_id ?? null,
    })
    .select("id, user_id, title, conversation_date, model_id, created_at, updated_at")
    .single();
  if (error) throw error;
  return data as ChatConversationRecord;
}

export async function appendChatMessages(
  conversationId: string,
  entries: Array<{
    role: "user" | "assistant";
    content: string;
    model_id?: string | null;
    used_fallback?: boolean;
    proposed_bill?: ProposedBillDraft | null;
  }>,
): Promise<void> {
  const rows = entries.map((entry) => ({
    conversation_id: conversationId,
    role: entry.role,
    content: entry.content,
    model_id: entry.model_id ?? null,
    used_fallback: Boolean(entry.used_fallback),
    proposed_bill: entry.proposed_bill ?? null,
  }));
  const { error } = await getSupabase().from("chat_messages").insert(rows);
  if (error) throw error;
  await getSupabase()
    .from("chat_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);
}

export async function deleteConversation(id: string): Promise<void> {
  const { error } = await getSupabase().from("chat_conversations").delete().eq("id", id);
  if (error) throw error;
}
