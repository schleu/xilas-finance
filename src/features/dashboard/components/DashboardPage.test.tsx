import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { currentMonthFortaleza } from "@/features/bills/schemas/billSchema";
import * as dashboardApi from "@/features/dashboard/api/dashboardApi";
import { formatMonthYearPT, shiftMonth } from "@/lib/dates";
import { DashboardPage } from "./DashboardPage";

vi.mock("@/features/dashboard/api/dashboardApi", () => ({
  getMonthlySummary: vi.fn(),
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

describe("DashboardPage (T-13 / US-1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("permite navegar entre meses (anterior, próximo e voltar ao mês atual)", async () => {
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

    const backToCurrentButton = screen.getByRole("button", { name: /mês atual/i });
    await user.click(backToCurrentButton);

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
