import { AlertTriangle, ChevronLeft, ChevronRight, CircleCheck, Clock, Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useBills } from "@/features/bills/hooks/useBills";
import { currentMonthFortaleza } from "@/features/bills/schemas/billSchema";
import {
  useMonthlyEvolution,
  useMonthlySummary,
  useSpendingByCategory,
} from "@/features/dashboard/hooks/useDashboard";
import { useMonthlyIncomeSummary } from "@/features/incomes/hooks/useIncomes";
import { formatMonthYearPT, shiftMonth } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { MonthlyEvolutionChart } from "./MonthlyEvolutionChart";
import { SpendingByCategoryChart } from "./SpendingByCategoryChart";
import { UpcomingBillsCard } from "./UpcomingBillsCard";

export function DashboardPage() {
  const currentMonth = currentMonthFortaleza();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const summaryQuery = useMonthlySummary(selectedMonth);
  const incomeSummaryQuery = useMonthlyIncomeSummary(selectedMonth);
  const categoryQuery = useSpendingByCategory(selectedMonth);
  const evolutionQuery = useMonthlyEvolution(selectedMonth, 6);
  const pendingBillsQuery = useBills({ month: selectedMonth, status: "pending" });

  const isCurrentMonth = selectedMonth === currentMonth;
  const monthLabel = formatMonthYearPT(selectedMonth);
  const summary = summaryQuery.data;
  const pendingBills = pendingBillsQuery.data ?? [];

  const isMonthEmpty =
    !summaryQuery.isLoading &&
    !summaryQuery.isError &&
    !pendingBillsQuery.isLoading &&
    !pendingBillsQuery.isError &&
    (summary?.paid_total_cents ?? 0) === 0 &&
    (summary?.pending_total_cents ?? 0) === 0 &&
    pendingBills.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Início</h1>
          <p className="text-sm text-muted-foreground">
            Resumo financeiro do mês de referência.
          </p>
        </div>

        <nav aria-label="Navegação de mês" className="flex flex-wrap items-center gap-2">
          {!isCurrentMonth && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelectedMonth(currentMonth)}
            >
              Mês atual
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Mês anterior"
            onClick={() => setSelectedMonth((prev) => shiftMonth(prev, -1))}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>

          <span
            aria-live="polite"
            className="min-w-[11rem] text-center text-sm font-medium"
          >
            {monthLabel}
          </span>

          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Próximo mês"
            onClick={() => setSelectedMonth((prev) => shiftMonth(prev, 1))}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </nav>
      </div>

      {summaryQuery.isError && (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          Não foi possível carregar o resumo do mês.{" "}
          {summaryQuery.error instanceof Error ? summaryQuery.error.message : ""}
        </div>
      )}

      {summaryQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando resumo do mês...</p>
      ) : (
        <section
          aria-label="Resumo do mês"
          className="grid gap-4 sm:grid-cols-3"
        >
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total gasto
                </CardTitle>
                <CircleCheck
                  className="h-4 w-4 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
              </div>
              <CardDescription>Somente lançamentos pagos no mês</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tracking-tight">
                {formatBRL(summary?.paid_total_cents ?? 0)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total pendente
                </CardTitle>
                <Clock
                  className="h-4 w-4 text-amber-600 dark:text-amber-400"
                  aria-hidden="true"
                />
              </div>
              <CardDescription>Lançamentos ainda não pagos</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tracking-tight">
                {formatBRL(summary?.pending_total_cents ?? 0)}
              </p>
            </CardContent>
          </Card>

          <Card
            className={
              (summary?.overdue_count ?? 0) > 0 ? "border-destructive/50" : undefined
            }
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Atrasados
                </CardTitle>
                <AlertTriangle
                  className={
                    (summary?.overdue_count ?? 0) > 0
                      ? "h-4 w-4 text-destructive"
                      : "h-4 w-4 text-muted-foreground"
                  }
                  aria-hidden="true"
                />
              </div>
              <CardDescription>Pendentes com vencimento passado</CardDescription>
            </CardHeader>
            <CardContent>
              <p
                className={
                  (summary?.overdue_count ?? 0) > 0
                    ? "text-2xl font-bold tracking-tight text-destructive"
                    : "text-2xl font-bold tracking-tight"
                }
              >
                {summary?.overdue_count ?? 0}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de rendas
              </CardTitle>
              <CardDescription>Entradas registradas no mês</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                {formatBRL(incomeSummaryQuery.data?.total_income_cents ?? 0)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Saldo do mês
              </CardTitle>
              <CardDescription>Rendas menos despesas pagas</CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const balanceCents =
                  (incomeSummaryQuery.data?.total_income_cents ?? 0) -
                  (summary?.paid_total_cents ?? 0);
                return (
                  <p
                    className={
                      balanceCents < 0
                        ? "text-2xl font-bold tracking-tight text-destructive"
                        : "text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400"
                    }
                  >
                    {formatBRL(balanceCents)}
                  </p>
                );
              })()}
            </CardContent>
          </Card>
        </section>
      )}

      {isMonthEmpty ? (
        <Card>
          <CardHeader className="text-center">
            <CardTitle>Nenhuma despesa registrada em {monthLabel}</CardTitle>
            <CardDescription>
              Cadastre sua primeira despesa para acompanhar gastos, vencimentos e gráficos do mês.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button asChild>
              <Link to="/despesas">
                <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Registrar primeira despesa
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <section
            aria-label="Gráficos de gastos"
            className="grid gap-4 lg:grid-cols-2"
          >
            <SpendingByCategoryChart
              data={categoryQuery.data ?? []}
              isLoading={categoryQuery.isLoading}
              isError={categoryQuery.isError}
              error={categoryQuery.error}
            />
            <MonthlyEvolutionChart
              data={evolutionQuery.data ?? []}
              isLoading={evolutionQuery.isLoading}
              isError={evolutionQuery.isError}
              error={evolutionQuery.error}
            />
          </section>

          <UpcomingBillsCard
            bills={pendingBills}
            isLoading={pendingBillsQuery.isLoading}
            isError={pendingBillsQuery.isError}
            error={pendingBillsQuery.error}
          />
        </>
      )}
    </div>
  );
}
