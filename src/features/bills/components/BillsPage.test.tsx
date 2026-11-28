import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as billsApi from "@/features/bills/api/billsApi";
import type { BillWithCategory } from "@/features/bills/api/billsApi";
import * as categoriesApi from "@/features/categories/api/categoriesApi";
import type { Category } from "@/features/categories/api/categoriesApi";
import { BillsPage } from "./BillsPage";

vi.mock("@/features/bills/api/billsApi", () => ({
  listBills: vi.fn(),
  createBill: vi.fn(),
  updateBill: vi.fn(),
  deleteBill: vi.fn(),
  markBillAsPaid: vi.fn(),
  stopRecurringRule: vi.fn(),
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

const mockedBillsApi = vi.mocked(billsApi);
const mockedCategoriesApi = vi.mocked(categoriesApi);

const categories: Category[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    user_id: "u1",
    name: "Fixa",
    is_default: true,
    created_at: "2026-11-26T00:00:00Z",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    user_id: "u1",
    name: "Variável",
    is_default: true,
    created_at: "2026-11-26T00:00:00Z",
  },
];

const sampleBills: BillWithCategory[] = [
  {
    id: "bill-1",
    user_id: "u1",
    description: "Energia elétrica",
    company: "Enel",
    category_id: categories[0]!.id,
    category_name: "Fixa",
    amount_cents: 25000,
    payment_type: "debit",
    bank: "Banco do Brasil",
    agency: "991234",
    account_number: "885678",
    due_date: "2020-01-10",
    status: "pending",
    paid_at: null,
    created_at: "2026-11-26T00:00:00Z",
    updated_at: "2026-11-26T00:00:00Z",
  },
  {
    id: "bill-2",
    user_id: "u1",
    description: "Internet fibra",
    company: null,
    category_id: categories[1]!.id,
    category_name: "Variável",
    amount_cents: 12050,
    payment_type: "pix",
    bank: null,
    agency: null,
    account_number: null,
    due_date: "2026-11-20",
    status: "paid",
    paid_at: "2026-11-19",
    created_at: "2026-11-26T00:00:00Z",
    updated_at: "2026-11-26T00:00:00Z",
  },
];

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <BillsPage />
    </QueryClientProvider>,
  );
}

describe("BillsPage (T-11 / US-2 & US-5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCategoriesApi.listCategories.mockResolvedValue(categories);
    mockedBillsApi.listBills.mockResolvedValue(sampleBills);
    mockedBillsApi.markBillAsPaid.mockResolvedValue(sampleBills[0]!);
    mockedBillsApi.deleteBill.mockResolvedValue(undefined);
    mockedBillsApi.createBill.mockResolvedValue(sampleBills[0]!);
    mockedBillsApi.updateBill.mockResolvedValue(sampleBills[0]!);
    mockedBillsApi.stopRecurringRule.mockResolvedValue(undefined);
  });

  it("exibe contas com valor BRL, status atrasado derivado e agência/conta mascarados", async () => {
    renderPage();

    expect(await screen.findByText("Energia elétrica")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*250,00/)).toBeInTheDocument();
    expect(screen.getByText(/10\/01\/2020/)).toBeInTheDocument();
    expect(screen.getByText("Atrasado")).toBeInTheDocument();

    // Agência e conta devem aparecer mascarados e nunca completos na lista
    expect(screen.getByText(/••••1234/)).toBeInTheDocument();
    expect(screen.getByText(/••••5678/)).toBeInTheDocument();
    expect(screen.queryByText(/991234/)).not.toBeInTheDocument();
    expect(screen.queryByText(/885678/)).not.toBeInTheDocument();
  });

  it("filtra contas por mês, categoria e status incluindo atrasadas", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText("Energia elétrica");

    await user.selectOptions(screen.getByLabelText(/filtrar por categoria/i), categories[0]!.id);
    await user.selectOptions(screen.getByLabelText(/filtrar por status/i), "overdue");

    await waitFor(() => {
      expect(mockedBillsApi.listBills).toHaveBeenLastCalledWith(
        expect.objectContaining({
          categoryId: categories[0]!.id,
          status: "overdue",
        }),
      );
    });
  });

  it("marca conta pendente como paga em um clique", async () => {
    const user = userEvent.setup();
    renderPage();

    const billItem = (await screen.findByText("Energia elétrica")).closest("li")!;
    await user.click(within(billItem).getByRole("button", { name: /marcar como pago/i }));

    await waitFor(() => {
      expect(mockedBillsApi.markBillAsPaid).toHaveBeenCalledWith("bill-1", undefined);
    });
  });

  it("exibe dados bancários completos ao editar e exige confirmação ao excluir", async () => {
    const user = userEvent.setup();
    renderPage();

    const billItem = (await screen.findByText("Energia elétrica")).closest("li")!;
    await user.click(within(billItem).getByRole("button", { name: /^editar$/i }));

    expect(await screen.findByLabelText(/^agência/i)).toHaveValue("991234");
    expect(screen.getByLabelText(/^conta/i)).toHaveValue("885678");

    await user.click(screen.getByRole("button", { name: /^cancelar$/i }));

    await user.click(within(billItem).getByRole("button", { name: /^excluir$/i }));
    expect(mockedBillsApi.deleteBill).not.toHaveBeenCalled();

    await user.click(within(billItem).getByRole("button", { name: /confirmar exclusão/i }));

    await waitFor(() => {
      expect(mockedBillsApi.deleteBill).toHaveBeenCalledWith("bill-1");
    });
  });

  it("exibe estado vazio claro quando não há contas", async () => {
    mockedBillsApi.listBills.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText(/nenhuma despesa encontrada/i)).toBeInTheDocument();
  });

  it("permite encerrar recorrência com confirmação preservando pagos (T-17 / US-2b)", async () => {
    const user = userEvent.setup();
    mockedBillsApi.listBills.mockResolvedValue([
      { ...sampleBills[0]!, recurring_rule_id: "rule-99" },
    ]);
    renderPage();

    const billItem = (await screen.findByText("Energia elétrica")).closest("li")!;
    expect(within(billItem).getByText("Recorrente")).toBeInTheDocument();

    await user.click(within(billItem).getByRole("button", { name: /encerrar recorrência/i }));
    expect(mockedBillsApi.stopRecurringRule).not.toHaveBeenCalled();

    await user.click(within(billItem).getByRole("button", { name: /confirmar encerramento/i }));
    await waitFor(() => {
      expect(mockedBillsApi.stopRecurringRule).toHaveBeenCalledWith("rule-99");
    });
  });
});
