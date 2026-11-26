import { CalendarClock, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { BillWithCategory } from "@/features/bills/api/billsApi";
import { useMarkBillAsPaid } from "@/features/bills/hooks/useBills";
import { isBillOverdue } from "@/features/bills/schemas/billSchema";
import { formatDateBR } from "@/lib/dates";
import { formatBRL } from "@/lib/money";

interface UpcomingBillsCardProps {
  bills: BillWithCategory[];
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
}

export function UpcomingBillsCard({
  bills,
  isLoading,
  isError,
  error,
}: UpcomingBillsCardProps) {
  const markPaidMutation = useMarkBillAsPaid();
  const [payingId, setPayingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleMarkAsPaid = async (id: string) => {
    setActionError(null);
    setPayingId(id);
    try {
      await markPaidMutation.mutateAsync({ id });
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Não foi possível marcar a conta como paga.",
      );
    } finally {
      setPayingId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Próximos vencimentos
          </CardTitle>
          <CardDescription>Contas pendentes do mês ordenadas por vencimento</CardDescription>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/contas">Ver todas</Link>
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        {actionError && (
          <div
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {actionError}
          </div>
        )}

        {isError ? (
          <div
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            Não foi possível carregar os próximos vencimentos.{" "}
            {error instanceof Error ? error.message : ""}
          </div>
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando próximos vencimentos...</p>
        ) : bills.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nenhum vencimento pendente neste mês.
          </p>
        ) : (
          <ul aria-label="Próximos vencimentos" className="divide-y">
            {bills.map((bill) => {
              const overdue = isBillOverdue(bill);
              const isPaying = payingId === bill.id;
              return (
                <li
                  key={bill.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium">{bill.description}</span>
                      <span
                        className={
                          overdue
                            ? "rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive"
                            : "rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400"
                        }
                      >
                        {overdue ? "Atrasado" : "Pendente"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {bill.category_name}
                      {bill.company ? ` · ${bill.company}` : ""} · Vence em{" "}
                      {formatDateBR(bill.due_date)}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-semibold tabular-nums">
                      {formatBRL(bill.amount_cents)}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isPaying}
                      onClick={() => void handleMarkAsPaid(bill.id)}
                    >
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                      {isPaying ? "Salvando..." : "Marcar como pago"}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
