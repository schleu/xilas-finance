import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext } from "@/features/auth/hooks/authContext";
import * as billsApi from "@/features/bills/api/billsApi";
import * as chatApi from "@/features/chat/api/chatApi";
import { ChatPage } from "./ChatPage";

vi.mock("@/features/chat/api/chatApi", () => ({
  fetchChatModels: vi.fn().mockResolvedValue([
    { id: "primary", label: "Llama 3.3", isDefault: true },
    { id: "deepseek", label: "DeepSeek", isDefault: false },
  ]),
  sendChatMessage: vi.fn(),
}));

vi.mock("@/features/chat/api/chatHistoryApi", () => ({
  getTodayConversation: vi.fn().mockResolvedValue(null),
  listConversations: vi.fn().mockResolvedValue([]),
  listConversationMessages: vi.fn().mockResolvedValue([]),
  createConversation: vi.fn().mockResolvedValue({
    id: "conv-1",
    user_id: "user-1",
    title: "Nova conversa",
    conversation_date: "2026-11-27",
    model_id: "primary",
    created_at: "2026-11-27T00:00:00Z",
    updated_at: "2026-11-27T00:00:00Z",
  }),
  appendChatMessages: vi.fn().mockResolvedValue(undefined),
  deleteConversation: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/features/bills/api/billsApi", () => ({
  createBill: vi.fn(),
}));

const mockedChatApi = vi.mocked(chatApi);
const mockedBillsApi = vi.mocked(billsApi);

function renderChat() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
  const authValue = {
    session: {
      access_token: "jwt-user-token",
      refresh_token: "ref",
      expires_in: 3600,
      token_type: "bearer" as const,
      user: {
        id: "user-1",
        email: "alice@example.com",
        app_metadata: {},
        user_metadata: {},
        aud: "authenticated",
        created_at: "2026-11-26T00:00:00Z",
      },
    },
    isLoading: false,
    needsPasswordSetup: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
    requestPasswordReset: vi.fn(),
    completePasswordSetup: vi.fn(),
  };

  render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        <ChatPage />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );

  return { invalidateSpy };
}

describe("ChatPage (T-24 / US-4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedBillsApi.createBill.mockResolvedValue({
      id: "bill-new",
      user_id: "user-1",
      description: "Internet",
      company: null,
      category_id: "11111111-1111-4111-8111-111111111111",
      amount_cents: 12000,
      payment_type: "pix",
      bank: null,
      agency: null,
      account_number: null,
      due_date: "2026-12-10",
      status: "pending",
      paid_at: null,
      created_at: "2026-11-26T00:00:00Z",
      updated_at: "2026-11-26T00:00:00Z",
    });
  });

  it("envia mensagem, exibe cartão de confirmação e só grava + invalida cache após confirmar", async () => {
    const user = userEvent.setup();
    const { invalidateSpy } = renderChat();

    mockedChatApi.sendChatMessage.mockResolvedValue({
      reply: "Montei o rascunho da sua conta. Confirma?",
      proposedBill: {
        description: "Internet",
        company: null,
        category_id: "11111111-1111-4111-8111-111111111111",
        category_name: "Fixa",
        amount_cents: 12000,
        payment_type: "pix",
        bank: null,
        agency: null,
        account_number: null,
        due_date: "2026-12-10",
        status: "pending",
        paid_at: null,
        recurring: false,
      },
    });

    await user.type(
      screen.getByLabelText(/mensagem para o assistente/i),
      "internet 120 no pix vence dia 10",
    );
    await user.click(screen.getByRole("button", { name: /enviar/i }));

    expect(await screen.findByText(/confirmar cadastro de conta/i)).toBeInTheDocument();
    expect(mockedBillsApi.createBill).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /confirmar e salvar/i }));

    await waitFor(() => {
      expect(mockedBillsApi.createBill).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText(/conta salva com sucesso/i)).toBeInTheDocument();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["bills"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["dashboard"] });
  });

  it("exibe erro amigável quando o provedor de LLM está indisponível", async () => {
    const user = userEvent.setup();
    renderChat();

    mockedChatApi.sendChatMessage.mockRejectedValue(
      new Error("O assistente está temporariamente indisponível."),
    );

    await user.type(screen.getByLabelText(/mensagem para o assistente/i), "oi");
    await user.click(screen.getByRole("button", { name: /enviar/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /assistente está temporariamente indisponível/i,
    );
  });
});
