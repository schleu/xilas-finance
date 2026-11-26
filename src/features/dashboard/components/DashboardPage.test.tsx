import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { currentMonthFortaleza } from "@/features/bills/schemas/billSchema";
import * as dashboardApi from "@/features/dashboard/api/dashboardApi";
import { formatMonthYearPT, formatShortMonthPT, monthRange, shiftMonth } from "@/lib/dates";
import { DashboardPage } from "./DashboardPage";

vi.mock("@/features/dashboard/api/dashboardApi", () => ({
  getMonthlySummary: vi.fn(),
  getSpendingByCategory: vi.fn(),
  getMonthlyEvolution: vi.fn(),
}));

const mockedDashboardApi = vi.mocked(dashboardApi);

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardPage />
    </QueryClientProvider>,
  );
}

describe("DashboardPage (T-13 & T-14 / US-1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedDashboardApi.getSpendingByCategory.mockResolvedValue([]);
    mockedDashboardApi.getMonthlyEvolution.mockResolvedValue([]);
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

    expect(await screen.findByText(/R\$\s*2\.070,50/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*730,00/)).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText(/total gasto/i)).toBeInTheDocument();
    expect(screen.getByText(/total pendente/i)).toBeInTheDocument();
    expect(screen.getByText(/atrasados/i)).toBeInTheDocument();
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

    expect(screen.getByText(/^gasto por categoria$/i)).toBeInTheDocument();
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

  it("exibe estado vazio nos gráficos quando não há gastos pagos", async () => {
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

    renderDashboard();

    expect(await screen.findByText(/nenhum gasto pago registrado neste mês/i)).toBeInTheDocument();
    expect(await screen.findByText(/nenhum gasto pago nos últimos 6 meses/i)).toBeInTheDocument();
  });

  it("permite navegar entre meses e atualiza resumo e gráficos", async () => {
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

    expect(await screen.findByText(/R\$\s*500,00/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mês atual/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /mês anterior/i }));

    expect(screen.getByText(formatMonthYearPT(prevMonth))).toBeInTheDocument();
    expect(await screen.findByText(/R\$\s*1\.500,00/)).toBeInTheDocument();
    expect(mockedDashboardApi.getMonthlySummary).toHaveBeenCalledWith(prevMonth);
    expect(mockedDashboardApi.getMonthlyEvolution).toHaveBeenCalledWith(6, prevMonth);

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
