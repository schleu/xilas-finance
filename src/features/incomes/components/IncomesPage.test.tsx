import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as banksApi from "@/features/banks/api/banksApi";
import * as incomesApi from "@/features/incomes/api/incomesApi";
import { IncomesPage } from "./IncomesPage";

vi.mock("@/features/banks/api/banksApi", () => ({
  listBanks: vi.fn(),
}));

vi.mock("@/features/incomes/api/incomesApi", () => ({
  listIncomeTypes: vi.fn(),
  createIncomeType: vi.fn(),
  deleteIncomeType: vi.fn(),
  listIncomes: vi.fn(),
  createIncome: vi.fn(),
  updateIncome: vi.fn(),
  deleteIncome: vi.fn(),
}));

describe("IncomesPage (005 & 012 / US-3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(banksApi.listBanks).mockResolvedValue([
      {
        id: "33333333-3333-4333-8333-333333333333",
        user_id: "u1",
        name: "Nubank",
        has_debit_account: true,
        agency: "0001",
        account_number: "12345",
        has_credit_card: false,
        credit_card_label: null,
        credit_card_due_day: null,
        created_at: "2026-11-27T00:00:00Z",
        updated_at: "2026-11-27T00:00:00Z",
      },
    ]);
    vi.mocked(incomesApi.listIncomeTypes).mockResolvedValue([
      {
        id: "11111111-1111-4111-8111-111111111111",
        user_id: "u1",
        name: "Salário",
        is_default: true,
        created_at: "2026-11-27T00:00:00Z",
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        user_id: "u1",
        name: "Freela",
        is_default: true,
        created_at: "2026-11-27T00:00:00Z",
      },
    ]);
    vi.mocked(incomesApi.listIncomes).mockResolvedValue([
      {
        id: "inc-1",
        user_id: "u1",
        description: "Salário Novembro",
        amount_cents: 500000,
        received_date: "2026-11-05",
        nature: "fixed",
        income_type_id: "11111111-1111-4111-8111-111111111111",
        income_type_name: "Salário",
        bank_id: "33333333-3333-4333-8333-333333333333",
        bank_name: "Nubank",
        created_at: "2026-11-27T00:00:00Z",
        updated_at: "2026-11-27T00:00:00Z",
      },
    ]);
    vi.mocked(incomesApi.createIncome).mockResolvedValue({
      id: "inc-2",
      user_id: "u1",
      description: "Freela App",
      amount_cents: 125050,
      received_date: "2026-11-10",
      nature: "variable",
      income_type_id: "22222222-2222-4222-8222-222222222222",
      bank_id: "33333333-3333-4333-8333-333333333333",
      created_at: "2026-11-27T00:00:00Z",
      updated_at: "2026-11-27T00:00:00Z",
    });
  });

  it("abre modal para cadastrar nova renda com conversão ponto para vírgula e exibe tabela ordenável", async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <IncomesPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Salário Novembro")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /nova renda/i }));
    const dialog = await screen.findByRole("dialog");

    await user.type(within(dialog).getByLabelText(/descrição/i), "Freela App");
    const amountInput = within(dialog).getByLabelText(/valor/i);
    await user.type(amountInput, "1250.50");
    await user.tab();
    expect(amountInput).toHaveValue("1250,50");

    await user.selectOptions(
      within(dialog).getByLabelText(/banco depositado/i),
      "33333333-3333-4333-8333-333333333333",
    );
    await user.click(within(dialog).getByRole("button", { name: /cadastrar renda/i }));

    await waitFor(() => {
      expect(incomesApi.createIncome).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Freela App",
          amount_cents: 125050,
          bank_id: "33333333-3333-4333-8333-333333333333",
        }),
      );
    });
  });

  it("abre filtros em modal e permite limpar filtros", async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <IncomesPage />
      </QueryClientProvider>,
    );

    await screen.findByText("Salário Novembro");
    await user.click(screen.getByRole("button", { name: /^filtros$/i }));

    const dialog = await screen.findByRole("dialog");
    await user.selectOptions(within(dialog).getByLabelText(/natureza/i), "variable");
    await user.click(within(dialog).getByRole("button", { name: /aplicar/i }));

    await waitFor(() => {
      expect(incomesApi.listIncomes).toHaveBeenLastCalledWith(
        expect.objectContaining({ nature: "variable" }),
      );
    });

    await user.click(screen.getByRole("button", { name: /limpar filtros/i }));
    await waitFor(() => {
      expect(incomesApi.listIncomes).toHaveBeenLastCalledWith(
        expect.objectContaining({ nature: "all" }),
      );
    });
  });
});
