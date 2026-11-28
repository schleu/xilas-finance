import type { Session } from "@supabase/supabase-js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "@/app/App";
import * as authApi from "@/features/auth/api/authApi";
import { AuthProvider } from "@/features/auth/components/AuthProvider";
import * as billsApi from "@/features/bills/api/billsApi";
import type { BillWithCategory } from "@/features/bills/api/billsApi";
import { currentMonthFortaleza } from "@/features/bills/schemas/billSchema";
import * as categoriesApi from "@/features/categories/api/categoriesApi";
import * as chatApi from "@/features/chat/api/chatApi";
import * as dashboardApi from "@/features/dashboard/api/dashboardApi";

vi.mock("@/features/auth/api/authApi", () => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithPassword: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updatePassword: vi.fn(),
  signOut: vi.fn(),
  hasPasswordSetupParams: vi.fn((loc: { hash: string; search: string }) => {
    const hashParams = new URLSearchParams(loc.hash.replace(/^#/, ""));
    return hashParams.get("type") === "invite";
  }),
}));

vi.mock("@/features/categories/api/categoriesApi", () => ({
  listCategories: vi.fn(),
}));

vi.mock("@/features/stores/api/storesApi", () => ({
  listStores: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/features/banks/api/banksApi", () => ({
  listBanks: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/features/incomes/api/incomesApi", () => ({
  getMonthlyIncomeSummary: vi.fn().mockResolvedValue({ month: "2026-11-01", total_income_cents: 0 }),
  listIncomes: vi.fn().mockResolvedValue([]),
  listIncomeTypes: vi.fn().mockResolvedValue([]),
  createIncome: vi.fn(),
}));

vi.mock("@/features/bills/api/billsApi", () => ({
  listBills: vi.fn(),
  createBill: vi.fn(),
  updateBill: vi.fn(),
  deleteBill: vi.fn(),
  markBillAsPaid: vi.fn(),
  stopRecurringRule: vi.fn(),
}));

vi.mock("@/features/dashboard/api/dashboardApi", () => ({
  getMonthlySummary: vi.fn(),
  getSpendingByCategory: vi.fn(),
  getMonthlyEvolution: vi.fn(),
}));

vi.mock("@/features/chat/api/chatApi", () => ({
  fetchChatModels: vi.fn().mockResolvedValue([]),
  sendChatMessage: vi.fn(),
}));

vi.mock("@/features/chat/api/chatHistoryApi", () => ({
  getTodayConversation: vi.fn().mockResolvedValue(null),
  listConversations: vi.fn().mockResolvedValue([]),
  listConversationMessages: vi.fn().mockResolvedValue([]),
  createConversation: vi.fn().mockResolvedValue({
    id: "conv-e2e",
    user_id: "user-e2e",
    title: "E2E",
    conversation_date: "2026-11-27",
    model_id: null,
    created_at: "2026-11-27T00:00:00Z",
    updated_at: "2026-11-27T00:00:00Z",
  }),
  appendChatMessages: vi.fn().mockResolvedValue(undefined),
  deleteConversation: vi.fn().mockResolvedValue(undefined),
}));

const mockedAuthApi = vi.mocked(authApi);
const mockedCategoriesApi = vi.mocked(categoriesApi);
const mockedBillsApi = vi.mocked(billsApi);
const mockedDashboardApi = vi.mocked(dashboardApi);
const mockedChatApi = vi.mocked(chatApi);

const CAT_FIXA_ID = "11111111-1111-4111-8111-111111111111";

function makeSession(): Session {
  return {
    access_token: "e2e-jwt-token",
    refresh_token: "e2e-refresh",
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: "user-e2e",
      email: "convidado@xilas.app",
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: "2026-11-26T00:00:00Z",
    },
  };
}

describe("Fluxos principais E2E (T-25)", () => {
  let store: BillWithCategory[];

  beforeEach(() => {
    vi.clearAllMocks();
    store = [];
    window.location.hash = "";
    window.history.replaceState(null, "", "/");

    const currentMonth = currentMonthFortaleza();

    mockedAuthApi.getSession.mockResolvedValue(makeSession());
    mockedAuthApi.onAuthStateChange.mockReturnValue(() => {});
    mockedAuthApi.updatePassword.mockResolvedValue(undefined);

    mockedCategoriesApi.listCategories.mockResolvedValue([
      {
        id: CAT_FIXA_ID,
        user_id: "user-e2e",
        name: "Fixa",
        is_default: true,
        created_at: "2026-11-26T00:00:00Z",
      },
    ]);

    mockedBillsApi.listBills.mockImplementation(async (filters = {}) => {
      return store.filter((bill) => {
        if (filters.status === "pending" && bill.status !== "pending") return false;
        if (filters.status === "paid" && bill.status !== "paid") return false;
        return true;
      });
    });

    mockedBillsApi.createBill.mockImplementation(async (input, options) => {
      const created: BillWithCategory = {
        description: input.description,
        company: input.company ?? null,
        category_id: input.category_id,
        amount_cents: input.amount_cents,
        payment_type: input.payment_type,
        bank: input.bank ?? null,
        agency: input.agency ?? null,
        account_number: input.account_number ?? null,
        due_date: input.due_date,
        reference_month: input.reference_month ?? `${input.due_date.slice(0, 7)}-01`,
        status: input.status,
        paid_at: input.paid_at ?? null,
        id: `bill-${store.length + 1}`,
        user_id: "user-e2e",
        category_name: "Fixa",
        recurring_rule_id: options?.recurring ? `rule-${store.length + 1}` : null,
        created_at: "2026-11-26T00:00:00Z",
        updated_at: "2026-11-26T00:00:00Z",
      };
      store.push(created);
      return created;
    });

    mockedBillsApi.markBillAsPaid.mockImplementation(async (id) => {
      const target = store.find((b) => b.id === id)!;
      target.status = "paid";
      target.paid_at = `${currentMonth}-10`;
      return target;
    });

    mockedDashboardApi.getMonthlySummary.mockImplementation(async (month) => {
      const paid = store
        .filter((b) => b.status === "paid")
        .reduce((sum, b) => sum + b.amount_cents, 0);
      const pending = store
        .filter((b) => b.status === "pending")
        .reduce((sum, b) => sum + b.amount_cents, 0);
      return {
        month: `${month}-01`,
        paid_total_cents: paid,
        pending_total_cents: pending,
        overdue_count: 0,
      };
    });

    mockedDashboardApi.getSpendingByCategory.mockImplementation(async () => {
      const paid = store
        .filter((b) => b.status === "paid")
        .reduce((sum, b) => sum + b.amount_cents, 0);
      return paid > 0
        ? [{ category_id: CAT_FIXA_ID, category_name: "Fixa", paid_total_cents: paid, bills_count: 1 }]
        : [];
    });

    mockedDashboardApi.getMonthlyEvolution.mockResolvedValue([
      { month: `${currentMonth}-01`, paid_total_cents: 0 },
    ]);
  });

  afterEach(() => {
    window.location.hash = "";
    window.history.replaceState(null, "", "/");
  });

  it("percorre login por convite, criação de conta recorrente, pagamento na homepage e adição/listagem via chat", async () => {
    const user = userEvent.setup();
    const currentMonth = currentMonthFortaleza();
    window.location.hash = "#access_token=tok&type=invite";

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={["/"]}>
            <AppRoutes />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>,
    );

    // 1. Convite -> definir senha -> homepage vazia
    expect(await screen.findByRole("heading", { name: /definir senha/i })).toBeInTheDocument();
    await user.type(screen.getByLabelText(/^nova senha$/i), "senha-forte-123");
    await user.type(screen.getByLabelText(/confirmar nova senha/i), "senha-forte-123");
    await user.click(screen.getByRole("button", { name: /salvar senha/i }));

    expect(await screen.findByRole("heading", { name: /^início$/i })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /registrar primeira despesa/i })).toBeInTheDocument();

    // 2. Ir para Despesas e cadastrar uma despesa recorrente
    await user.click(screen.getByRole("link", { name: /registrar primeira despesa/i }));
    expect(await screen.findByRole("heading", { name: /^despesas$/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /nova despesa/i }));
    await user.type(screen.getByLabelText(/descrição/i), "Aluguel");
    await user.type(screen.getByLabelText(/valor/i), "1500,00");
    await user.clear(screen.getByLabelText(/vencimento/i));
    await user.type(screen.getByLabelText(/vencimento/i), `${currentMonth}-15`);
    await user.click(screen.getByLabelText(/^recorrente/i));
    await user.click(screen.getByRole("button", { name: /salvar despesa/i }));

    expect(await screen.findByText("Aluguel")).toBeInTheDocument();
    expect(screen.getByText("Recorrente")).toBeInTheDocument();

    // 3. Voltar ao Início e marcar como pago em um clique
    await user.click(screen.getByRole("link", { name: /^início$/i }));
    const upcomingList = await screen.findByRole("list", { name: /próximos vencimentos/i });
    expect(within(upcomingList).getByText("Aluguel")).toBeInTheDocument();

    await user.click(within(upcomingList).getByRole("button", { name: /marcar como pago/i }));
    await waitFor(() => {
      expect(screen.getByText(/nenhum vencimento pendente neste mês/i)).toBeInTheDocument();
    });

    // 4. Ir ao Chat: listar contas e adicionar nova conta com confirmação
    mockedChatApi.sendChatMessage
      .mockResolvedValueOnce({
        reply: "Você tem 1 conta paga neste mês: Aluguel (R$ 1.500,00).",
      })
      .mockResolvedValueOnce({
        reply: "Confira o rascunho da conta Internet abaixo.",
        proposedBill: {
          description: "Internet fibra",
          company: null,
          category_id: CAT_FIXA_ID,
          category_name: "Fixa",
          amount_cents: 12000,
          payment_type: "pix",
          bank: null,
          agency: null,
          account_number: null,
          due_date: `${currentMonth}-20`,
          status: "pending",
          paid_at: null,
          recurring: false,
        },
      });

    await user.click(screen.getByRole("link", { name: /^chat$/i }));
    expect(await screen.findByRole("heading", { name: /^chat$/i })).toBeInTheDocument();

    const input = screen.getByLabelText(/mensagem para o assistente/i);
    await user.type(input, "quais contas tenho este mês?");
    await user.click(screen.getByRole("button", { name: /enviar/i }));
    expect(await screen.findByText(/aluguel \(r\$ 1\.500,00\)/i)).toBeInTheDocument();

    await user.type(input, "internet fibra 120 no pix vence dia 20");
    await user.click(screen.getByRole("button", { name: /enviar/i }));
    expect(await screen.findByText(/confirmar cadastro de conta/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /confirmar e salvar/i }));
    expect(await screen.findByText(/conta salva com sucesso/i)).toBeInTheDocument();

    // 5. Verificar que a despesa criada via chat aparece imediatamente em Despesas
    await user.click(screen.getByRole("link", { name: /^despesas$/i }));
    expect(await screen.findByText("Internet fibra")).toBeInTheDocument();
  });
});
