import { Send } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useCreateBill } from "@/features/bills/hooks/useBills";
import { sendChatMessage } from "@/features/chat/api/chatApi";
import { BillProposalCard } from "@/features/chat/components/BillProposalCard";
import type { ChatMessageItem } from "@/features/chat/schemas/chatSchemas";

const QUICK_PROMPTS = [
  "Quais contas vencem esta semana?",
  "Quanto gastei por categoria este mês?",
  "Internet 120 no pix vence dia 10",
];

let messageCounter = 0;
function nextMessageId(): string {
  messageCounter += 1;
  return `msg-${messageCounter}`;
}

export function ChatPage() {
  const { session } = useAuth();
  const createBillMutation = useCreateBill();

  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [savingProposalId, setSavingProposalId] = useState<string | null>(null);
  const [proposalErrors, setProposalErrors] = useState<Record<string, string | null>>({});

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
      );

      const assistantMessage: ChatMessageItem = {
        id: nextMessageId(),
        role: "assistant",
        content:
          response.reply ||
          (response.proposedBill
            ? "Confira o rascunho abaixo e clique em confirmar para salvar."
            : "Pronto!"),
        proposedBill: response.proposedBill,
        proposalStatus: response.proposedBill ? "pending" : undefined,
      };

      setMessages((prev) => [...prev, assistantMessage]);
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
          error instanceof Error ? error.message : "Não foi possível salvar a conta proposta.",
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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Chat</h1>
        <p className="text-sm text-muted-foreground">
          Adicione contas, consulte vencimentos ou peça relatórios em linguagem natural.
        </p>
      </div>

      <Card className="flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Assistente financeiro</CardTitle>
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
                  Como posso ajudar com suas contas hoje?
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
              placeholder="Ex.: internet 120 no pix vence dia 10"
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
