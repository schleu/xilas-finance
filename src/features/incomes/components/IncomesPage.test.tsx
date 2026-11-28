import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
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

describe("IncomesPage (005 / US-1)", () => {
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
    vi.mocked(incomesApi.listIncomes).mockResolvedValue([]);
    vi.mocked(incomesApi.createIncome).mockResolvedValue({
      id: "inc-1",
      user_id: "u1",
      description: "Salário Novembro",
      amount_cents: 500000,
      received_date: "2026-11-05",
      nature: "fixed",
      income_type_id: "11111111-1111-4111-8111-111111111111",
      bank_id: "33333333-3333-4333-8333-333333333333",
      created_at: "2026-11-27T00:00:00Z",
      updated_at: "2026-11-27T00:00:00Z",
    });
  });

  it("permite cadastrar nova renda com valor em centavos inteiros e banco depositado", async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <IncomesPage />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole("button", { name: /nova renda/i }));
    await user.type(screen.getByLabelText(/descrição/i), "Salário Novembro");
    await user.type(screen.getByLabelText(/valor/i), "5000,00");
    await user.selectOptions(screen.getByLabelText(/banco depositado/i), "33333333-3333-4333-8333-333333333333");
    await user.click(screen.getByRole("button", { name: /cadastrar renda/i }));

    await waitFor(() => {
      expect(incomesApi.createIncome).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Salário Novembro",
          amount_cents: 500000,
          nature: "fixed",
          bank_id: "33333333-3333-4333-8333-333333333333",
        }),
      );
    });
  });
});
