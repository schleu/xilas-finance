import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as billsApi from "@/features/bills/api/billsApi";
import type { BillWithCategory } from "@/features/bills/api/billsApi";
import { currentMonthFortaleza } from "@/features/bills/schemas/billSchema";
import * as dashboardApi from "@/features/dashboard/api/dashboardApi";
import { formatMonthYearPT, formatShortMonthPT, monthRange, shiftMonth } from "@/lib/dates";
import { DashboardPage } from "./DashboardPage";

vi.mock("@/features/dashboard/api/dashboardApi", () => ({
  getMonthlySummary: vi.fn(),
  getSpendingByCategory: vi.fn(),
  getMonthlyEvolution: vi.fn(),
}));

vi.mock("@/features/bills/api/billsApi", () => ({
  listBills: vi.fn(),
  markBillAsPaid: vi.fn(),
}));

vi.mock("@/features/incomes/api/incomesApi", () => ({
  getMonthlyIncomeSummary: vi.fn().mockResolvedValue({ month: "2026-11-01", total_income_cents: 0 }),
}));

const mockedDashboardApi = vi.mocked(dashboardApi);
const mockedBillsApi = vi.mocked(billsApi);

function makePendingBill(overrides: Partial<BillWithCategory> = {}): BillWithCategory {
  return {
    id: "bill-1",
    user_id: "user-1",
    description: "Energia elétrica",
    company: "Enel",
    category_id: "cat-fixa",
    category_name: "Fixa",
    amount_cents: 25000,
    payment_type: "pix",
    bank: null,
    agency: null,
    account_number: null,
    due_date: "2026-11-28",
    status: "pending",
    paid_at: null,
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-01T00:00:00Z",
    ...overrides,
  };
}

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("DashboardPage (T-13, T-14 & T-15 / US-1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedDashboardApi.getSpendingByCategory.mockResolvedValue([]);
    mockedDashboardApi.getMonthlyEvolution.mockResolvedValue([]);
    mockedBillsApi.listBills.mockResolvedValue([]);
    mockedBillsApi.markBillAsPaid.mockResolvedValue(makePendingBill({ status: "paid" }));
  });

  it("exibe total gasto (somente pagos), total pendente e quantidade de atrasados do mês atual", async () => {
    const currentMonth = currentMonthFortaleza();
    mockedDashboardApi.getMonthlySummary.mockResolvedValue({
      month: `${currentMonth}-01`,
      paid_total_cents: 207050,
      pending_total_cents: 73000,
      overdue_count: 2,
    });

    renderDashboard();

    expect(screen.getByRole("heading", { name: /^início$/i })).toBeInTheDocument();
    expect(screen.getByText(formatMonthYearPT(currentMonth))).toBeInTheDocument();

    expect(await screen.findByText(/^R\$\s*2\.070,50$/)).toBeInTheDocument();
    expect(screen.getByText(/^R\$\s*730,00$/)).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText(/total gasto/i)).toBeInTheDocument();
    expect(screen.getByText(/total pendente/i)).toBeInTheDocument();
    expect(screen.getByText(/atrasados/i)).toBeInTheDocument();
    expect(screen.getByText(/total de rendas/i)).toBeInTheDocument();
    expect(screen.getByText(/saldo do mês/i)).toBeInTheDocument();
    expect(mockedDashboardApi.getMonthlySummary).toHaveBeenCalledWith(currentMonth);
  });

  it("exibe gráficos de gasto por categoria e evolução mensal de 6 meses (somente pagos)", async () => {
    const currentMonth = currentMonthFortaleza();
    const { from, to } = monthRange(currentMonth);
    const evolutionMonths = Array.from({ length: 6 }, (_, idx) => {
      const m = shiftMonth(currentMonth, idx - 5);
      return {
        month: `${m}-01`,
        paid_total_cents: idx === 5 ? 207050 : idx === 4 ? 150000 : 0,
      };
    });

    mockedDashboardApi.getMonthlySummary.mockResolvedValue({
      month: `${currentMonth}-01`,
      paid_total_cents: 207050,
      pending_total_cents: 0,
      overdue_count: 0,
    });
    mockedDashboardApi.getSpendingByCategory.mockResolvedValue([
      {
        category_id: "cat-fixa",
        category_name: "Fixa",
        paid_total_cents: 162050,
        bills_count: 2,
      },
      {
        category_id: "cat-var",
        category_name: "Variável",
        paid_total_cents: 45000,
        bills_count: 1,
      },
    ]);
    mockedDashboardApi.getMonthlyEvolution.mockResolvedValue(evolutionMonths);

    renderDashboard();

    expect(await screen.findByText(/^gasto por categoria$/i)).toBeInTheDocument();
    expect(screen.getByText(/^evolução mensal$/i)).toBeInTheDocument();

    const categoryList = await screen.findByRole("list", {
      name: /detalhamento por categoria/i,
    });
    expect(within(categoryList).getByText("Fixa")).toBeInTheDocument();
    expect(within(categoryList).getByText(/R\$\s*1\.620,50/)).toBeInTheDocument();
    expect(within(categoryList).getByText("Variável")).toBeInTheDocument();
    expect(within(categoryList).getByText(/R\$\s*450,00/)).toBeInTheDocument();

    const evolutionList = await screen.findByRole("list", {
      name: /totais pagos por mês/i,
    });
    expect(within(evolutionList).getAllByRole("listitem")).toHaveLength(6);
    expect(
      within(evolutionList).getByText(formatShortMonthPT(currentMonth)),
    ).toBeInTheDocument();
    expect(within(evolutionList).getByText(/R\$\s*1\.500,00/)).toBeInTheDocument();

    expect(mockedDashboardApi.getSpendingByCategory).toHaveBeenCalledWith(from, to);
    expect(mockedDashboardApi.getMonthlyEvolution).toHaveBeenCalledWith(6, currentMonth);
  });

  it("exibe próximos vencimentos ordenados com badge de atraso e ação rápida de marcar como pago", async () => {
    const user = userEvent.setup();
    const currentMonth = currentMonthFortaleza();
    mockedDashboardApi.getMonthlySummary.mockResolvedValue({
      month: `${currentMonth}-01`,
      paid_total_cents: 0,
      pending_total_cents: 37000,
      overdue_count: 1,
    });
    mockedBillsApi.listBills.mockResolvedValue([
      makePendingBill({
        id: "bill-overdue",
        description: "Água atrasada",
        due_date: "2020-01-10",
        amount_cents: 12000,
      }),
      makePendingBill({
        id: "bill-upcoming",
        description: "Internet fibra",
        due_date: "2099-12-20",
        amount_cents: 25000,
      }),
    ]);

    renderDashboard();

    const upcomingList = await screen.findByRole("list", { name: /próximos vencimentos/i });
    const items = within(upcomingList).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    const [firstItem, secondItem] = items;
    if (!firstItem || !secondItem) throw new Error("Esperava 2 itens nos próximos vencimentos");
    expect(within(firstItem).getByText("Água atrasada")).toBeInTheDocument();
    expect(within(firstItem).getByText("Atrasado")).toBeInTheDocument();
    expect(within(secondItem).getByText("Internet fibra")).toBeInTheDocument();
    expect(within(secondItem).getByText("Pendente")).toBeInTheDocument();

    await user.click(within(firstItem).getByRole("button", { name: /marcar como pago/i }));

    await waitFor(() => {
      expect(mockedBillsApi.markBillAsPaid).toHaveBeenCalledWith("bill-overdue", undefined);
    });
    expect(mockedBillsApi.listBills).toHaveBeenCalledWith({
      month: currentMonth,
      status: "pending",
    });
  });

  it("exibe estado vazio claro com atalho para criar a primeira conta quando não há contas no mês", async () => {
    const currentMonth = currentMonthFortaleza();
    mockedDashboardApi.getMonthlySummary.mockResolvedValue({
      month: `${currentMonth}-01`,
      paid_total_cents: 0,
      pending_total_cents: 0,
      overdue_count: 0,
    });
    mockedBillsApi.listBills.mockResolvedValue([]);

    renderDashboard();

    expect(
      await screen.findByText(new RegExp(`nenhuma despesa registrada em ${formatMonthYearPT(currentMonth)}`, "i")),
    ).toBeInTheDocument();
    const createLink = screen.getByRole("link", { name: /criar primeira despesa/i });
    expect(createLink).toHaveAttribute("href", "/despesas");
  });

  it("exibe estado vazio nos gráficos quando há apenas contas pendentes (sem pagos)", async () => {
    const currentMonth = currentMonthFortaleza();
    mockedDashboardApi.getMonthlySummary.mockResolvedValue({
      month: `${currentMonth}-01`,
      paid_total_cents: 0,
      pending_total_cents: 50000,
      overdue_count: 0,
    });
    mockedDashboardApi.getSpendingByCategory.mockResolvedValue([]);
    mockedDashboardApi.getMonthlyEvolution.mockResolvedValue(
      Array.from({ length: 6 }, (_, idx) => ({
        month: `${shiftMonth(currentMonth, idx - 5)}-01`,
        paid_total_cents: 0,
      })),
    );
    mockedBillsApi.listBills.mockResolvedValue([makePendingBill({ amount_cents: 50000 })]);

    renderDashboard();

    expect(await screen.findByText(/nenhum gasto pago registrado neste mês/i)).toBeInTheDocument();
    expect(await screen.findByText(/nenhum gasto pago nos últimos 6 meses/i)).toBeInTheDocument();
  });

  it("permite navegar entre meses e atualiza resumo, gráficos e vencimentos", async () => {
    const user = userEvent.setup();
    const currentMonth = currentMonthFortaleza();
    const prevMonth = shiftMonth(currentMonth, -1);

    mockedDashboardApi.getMonthlySummary.mockImplementation(async (month) => {
      if (month === prevMonth) {
        return {
          month: `${prevMonth}-01`,
          paid_total_cents: 150000,
          pending_total_cents: 0,
          overdue_count: 0,
        };
      }
      return {
        month: `${month}-01`,
        paid_total_cents: 50000,
        pending_total_cents: 12000,
        overdue_count: 1,
      };
    });

    renderDashboard();

    expect(await screen.findByText(/^R\$\s*500,00$/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mês atual/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /mês anterior/i }));

    expect(screen.getByText(formatMonthYearPT(prevMonth))).toBeInTheDocument();
    expect(await screen.findByText(/^R\$\s*1\.500,00$/)).toBeInTheDocument();
    expect(mockedDashboardApi.getMonthlySummary).toHaveBeenCalledWith(prevMonth);
    expect(mockedDashboardApi.getMonthlyEvolution).toHaveBeenCalledWith(6, prevMonth);
    expect(mockedBillsApi.listBills).toHaveBeenCalledWith({
      month: prevMonth,
      status: "pending",
    });

    const prevRange = monthRange(prevMonth);
    expect(mockedDashboardApi.getSpendingByCategory).toHaveBeenCalledWith(
      prevRange.from,
      prevRange.to,
    );

    await user.click(screen.getByRole("button", { name: /mês atual/i }));
    await waitFor(() => {
      expect(screen.getByText(formatMonthYearPT(currentMonth))).toBeInTheDocument();
    });

    const nextMonth = shiftMonth(currentMonth, 1);
    await user.click(screen.getByRole("button", { name: /próximo mês/i }));

    expect(screen.getByText(formatMonthYearPT(nextMonth))).toBeInTheDocument();
    await waitFor(() => {
      expect(mockedDashboardApi.getMonthlySummary).toHaveBeenCalledWith(nextMonth);
    });
  });

  it("exibe alerta amigável quando falha ao carregar o resumo do mês", async () => {
    mockedDashboardApi.getMonthlySummary.mockRejectedValue(new Error("Falha de conexão"));

    renderDashboard();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /não foi possível carregar o resumo do mês.*falha de conexão/i,
    );
  });
});
