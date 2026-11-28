import { History, Plus, Send, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useCreateBill } from "@/features/bills/hooks/useBills";
import { todayIsoFortaleza } from "@/features/bills/schemas/billSchema";
import {
  fetchChatModels,
  sendChatMessage,
  type ChatModelOption,
} from "@/features/chat/api/chatApi";
import {
  appendChatMessages,
  createConversation,
  deleteConversation,
  getTodayConversation,
  listConversationMessages,
  listConversations,
  type ChatConversationRecord,
} from "@/features/chat/api/chatHistoryApi";
import { BillProposalCard } from "@/features/chat/components/BillProposalCard";
import type { ChatMessageItem } from "@/features/chat/schemas/chatSchemas";
import { formatDateBR } from "@/lib/dates";

const QUICK_PROMPTS = [
  "Quais despesas vencem esta semana?",
  "Quanto gastei por categoria este mês?",
  "Adicionar 200 em conta de água",
];

let messageCounter = 0;
function nextMessageId(): string {
  messageCounter += 1;
  return `msg-${messageCounter}`;
}

export function ChatPage() {
  const { session } = useAuth();
  const createBillMutation = useCreateBill();

  const [models, setModels] = useState<ChatModelOption[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ChatConversationRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [savingProposalId, setSavingProposalId] = useState<string | null>(null);
  const [proposalErrors, setProposalErrors] = useState<Record<string, string | null>>({});

  useEffect(() => {
    const token = session?.access_token;
    if (!token) return;
    let cancelled = false;

    void (async () => {
      try {
        const fetched = await fetchChatModels(token);
        if (!cancelled && fetched.length > 0) {
          setModels(fetched);
          const def = fetched.find((m) => m.isDefault) ?? fetched[0]!;
          setSelectedModelId(def.id);
        }
      } catch {
        // Ignore if model discovery fails
      }
    })();

    void (async () => {
      try {
        const todayIso = todayIsoFortaleza();
        const todayConv = await getTodayConversation(todayIso);
        if (!cancelled && todayConv) {
          setActiveConversationId(todayConv.id);
          const saved = await listConversationMessages(todayConv.id);
          if (!cancelled) {
            setMessages(
              saved.map((m) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                proposedBill: m.proposed_bill ?? undefined,
                proposalStatus: m.proposed_bill ? "saved" : undefined,
              })),
            );
          }
        }
      } catch {
        // Gracefully fall back to ephemeral session when DB unavailable
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.access_token]);

  const loadHistoryList = async () => {
    try {
      const list = await listConversations();
      setConversations(list);
    } catch {
      setConversations([]);
    }
  };

  const handleToggleHistory = () => {
    const next = !showHistory;
    setShowHistory(next);
    if (next) {
      void loadHistoryList();
    }
  };

  const handleOpenConversation = async (conv: ChatConversationRecord) => {
    setChatError(null);
    setActiveConversationId(conv.id);
    try {
      const saved = await listConversationMessages(conv.id);
      setMessages(
        saved.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          proposedBill: m.proposed_bill ?? undefined,
          proposalStatus: m.proposed_bill ? "saved" : undefined,
        })),
      );
    } catch {
      setMessages([]);
    }
    setShowHistory(false);
  };

  const handleNewConversation = () => {
    setActiveConversationId(null);
    setMessages([]);
    setChatError(null);
    setShowHistory(false);
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) {
        setActiveConversationId(null);
        setMessages([]);
      }
    } catch {
      setChatError("Não foi possível excluir a conversa.");
    }
  };

  const submitMessage = async (rawText: string) => {
    const content = rawText.trim();
    if (!content || isSending) return;

    const accessToken = session?.access_token;
    if (!accessToken) {
      setChatError("Sessão expirada. Faça login novamente para usar o chat.");
      return;
    }

    setChatError(null);
    setInputText("");

    const userMessage: ChatMessageItem = {
      id: nextMessageId(),
      role: "user",
      content,
    };

    const nextHistory = [...messages, userMessage];
    setMessages(nextHistory);
    setIsSending(true);

    try {
      const response = await sendChatMessage(
        nextHistory.map((m) => ({ role: m.role, content: m.content })),
        accessToken,
        selectedModelId || undefined,
      );

      const assistantContent =
        response.reply ||
        (response.proposedBill
          ? "Confira o rascunho abaixo e clique em confirmar para salvar."
          : "Pronto!");

      const assistantMessage: ChatMessageItem = {
        id: nextMessageId(),
        role: "assistant",
        content: assistantContent,
        proposedBill: response.proposedBill,
        proposalStatus: response.proposedBill ? "pending" : undefined,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Persist conversation & messages best-effort
      try {
        let convId = activeConversationId;
        if (!convId) {
          const created = await createConversation({
            title: content,
            conversation_date: todayIsoFortaleza(),
            model_id: selectedModelId || null,
          });
          convId = created.id;
          setActiveConversationId(convId);
        }
        await appendChatMessages(convId, [
          { role: "user", content, model_id: selectedModelId || null },
          {
            role: "assistant",
            content: assistantContent,
            model_id: response.modelId ?? (selectedModelId || null),
            used_fallback: response.usedFallback,
            proposed_bill: response.proposedBill ?? null,
          },
        ]);
      } catch {
        // Non-blocking persistence error
      }
    } catch (error) {
      setChatError(
        error instanceof Error
          ? error.message
          : "O assistente está temporariamente indisponível. Você pode usar o app manualmente.",
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleConfirmProposal = async (message: ChatMessageItem) => {
    if (!message.proposedBill) return;
    setSavingProposalId(message.id);
    setProposalErrors((prev) => ({ ...prev, [message.id]: null }));

    try {
      const { category_name: _unusedName, recurring, ...billInput } = message.proposedBill;
      void _unusedName;
      await createBillMutation.mutateAsync({ input: billInput, recurring });
      setMessages((prev) =>
        prev.map((item) =>
          item.id === message.id ? { ...item, proposalStatus: "saved" } : item,
        ),
      );
    } catch (error) {
      setProposalErrors((prev) => ({
        ...prev,
        [message.id]:
          error instanceof Error ? error.message : "Não foi possível salvar a despesa proposta.",
      }));
    } finally {
      setSavingProposalId(null);
    }
  };

  const handleCancelProposal = (messageId: string) => {
    setMessages((prev) =>
      prev.map((item) =>
        item.id === messageId ? { ...item, proposalStatus: "cancelled" } : item,
      ),
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Chat</h1>
          <p className="text-sm text-muted-foreground">
            Adicione despesas, consulte vencimentos ou peça relatórios em linguagem natural.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {models.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Label htmlFor="chat-model-select" className="sr-only">
                Modelo de LLM
              </Label>
              <select
                id="chat-model-select"
                aria-label="Modelo de LLM"
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                value={selectedModelId}
                onChange={(e) => setSelectedModelId(e.target.value)}
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Button type="button" variant="outline" size="sm" onClick={handleNewConversation}>
            <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            Nova conversa
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleToggleHistory}>
            <History className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            Histórico
          </Button>
        </div>
      </div>

      {showHistory && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Histórico de conversas</CardTitle>
          </CardHeader>
          <CardContent>
            {conversations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma conversa anterior salva.</p>
            ) : (
              <ul className="divide-y text-sm">
                {conversations.map((conv) => (
                  <li key={conv.id} className="flex items-center justify-between gap-2 py-2">
                    <button
                      type="button"
                      className="flex-1 truncate text-left hover:underline"
                      onClick={() => void handleOpenConversation(conv)}
                    >
                      <span className="font-medium">{conv.title}</span>{" "}
                      <span className="text-xs text-muted-foreground">
                        ({formatDateBR(conv.conversation_date)})
                      </span>
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Excluir conversa ${conv.title}`}
                      onClick={() => void handleDeleteConversation(conv.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Assistente financeiro (hoje)</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div
            role="log"
            aria-label="Histórico da conversa"
            aria-live="polite"
            className="min-h-[260px] max-h-[460px] space-y-3 overflow-y-auto rounded-md border bg-muted/20 p-4"
          >
            {messages.length === 0 ? (
              <div className="space-y-3 py-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Como posso ajudar com suas despesas hoje?
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {QUICK_PROMPTS.map((prompt) => (
                    <Button
                      key={prompt}
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isSending}
                      onClick={() => void submitMessage(prompt)}
                    >
                      {prompt}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={msg.role === "user" ? "flex justify-end" : "flex justify-start"}
                >
                  <div
                    className={
                      msg.role === "user"
                        ? "max-w-[85%] rounded-lg bg-primary px-3.5 py-2 text-sm text-primary-foreground"
                        : "max-w-[85%] rounded-lg border bg-card px-3.5 py-2 text-sm text-card-foreground"
                    }
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    {msg.proposedBill && msg.proposalStatus && (
                      <BillProposalCard
                        proposal={msg.proposedBill}
                        status={msg.proposalStatus}
                        isSaving={savingProposalId === msg.id}
                        error={proposalErrors[msg.id] ?? null}
                        onConfirm={() => void handleConfirmProposal(msg)}
                        onCancel={() => handleCancelProposal(msg.id)}
                      />
                    )}
                  </div>
                </div>
              ))
            )}

            {isSending && (
              <p role="status" className="text-xs text-muted-foreground">
                Assistente pensando...
              </p>
            )}
          </div>

          {chatError && (
            <div
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {chatError}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submitMessage(inputText);
            }}
            className="flex gap-2"
          >
            <Label htmlFor="chat-input" className="sr-only">
              Mensagem para o assistente
            </Label>
            <Input
              id="chat-input"
              value={inputText}
              disabled={isSending}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ex.: Adicionar 200 em conta de água"
            />
            <Button type="submit" disabled={isSending || !inputText.trim()}>
              <Send className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Enviar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
