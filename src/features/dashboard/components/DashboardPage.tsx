import { AlertTriangle, ChevronLeft, ChevronRight, CircleCheck, Clock } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { currentMonthFortaleza } from "@/features/bills/schemas/billSchema";
import { useMonthlySummary } from "@/features/dashboard/hooks/useDashboard";
import { formatMonthYearPT, shiftMonth } from "@/lib/dates";
import { formatBRL } from "@/lib/money";

export function DashboardPage() {
  const currentMonth = currentMonthFortaleza();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const summaryQuery = useMonthlySummary(selectedMonth);

  const isCurrentMonth = selectedMonth === currentMonth;
  const monthLabel = formatMonthYearPT(selectedMonth);
  const summary = summaryQuery.data;

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
                <CircleCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
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
                <Clock className="h-4 w-4 text-amber-600" aria-hidden="true" />
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
        </section>
      )}
    </div>
  );
}
