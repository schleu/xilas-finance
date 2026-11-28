import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BillStatusFilter, BillWithCategory } from "@/features/bills/api/billsApi";
import { replaceBillItems } from "@/features/bills/api/billItemsApi";
import { BillForm, type BillFormSubmitMeta } from "@/features/bills/components/BillForm";
import {
  useBills,
  useCreateBill,
  useDeleteBill,
  useMarkBillAsPaid,
  useStopRecurringRule,
  useUpdateBill,
} from "@/features/bills/hooks/useBills";
import {
  PAYMENT_TYPE_LABELS,
  currentMonthFortaleza,
  isBillOverdue,
  maskBankCode,
  type BillInput,
} from "@/features/bills/schemas/billSchema";
import { useBanks } from "@/features/banks/hooks/useBanks";
import { useCategories } from "@/features/categories/hooks/useCategories";
import { CsvImportDialog } from "@/features/csvImport/components/CsvImportDialog";
import { useStores } from "@/features/stores/hooks/useStores";
import { formatDateBR } from "@/lib/dates";
import { formatBRL } from "@/lib/money";

export function BillsPage() {
  const [month, setMonth] = useState(currentMonthFortaleza);
  const [categoryId, setCategoryId] = useState("");
  const [statusFilter, setStatusFilter] = useState<BillStatusFilter>("all");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [editingBill, setEditingBill] = useState<BillWithCategory | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmStopRuleId, setConfirmStopRuleId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: categories = [] } = useCategories();
  const { data: stores = [] } = useStores();
  const { data: banks = [] } = useBanks();
  const {
    data: bills = [],
    isLoading,
    error: loadError,
  } = useBills({
    month: month || undefined,
    categoryId: categoryId || undefined,
    status: statusFilter,
  });

  const createMutation = useCreateBill();
  const updateMutation = useUpdateBill();
  const deleteMutation = useDeleteBill();
  const markPaidMutation = useMarkBillAsPaid();
  const stopRecurringMutation = useStopRecurringRule();

  const handleCreate = async (input: BillInput, meta?: BillFormSubmitMeta) => {
    setActionError(null);
    const created = await createMutation.mutateAsync({ input, recurring: meta?.recurring });
    if (meta?.items && meta.items.length > 0 && created?.id) {
      await replaceBillItems(created.id, meta.items);
    }
    setShowCreateForm(false);
  };

  const handleUpdate = async (input: BillInput, meta?: BillFormSubmitMeta) => {
    if (!editingBill) return;
    setActionError(null);
    await updateMutation.mutateAsync({
      id: editingBill.id,
      input,
      scope: meta?.editScope,
      recurringRuleId: editingBill.recurring_rule_id,
      originalDueDate: editingBill.due_date,
    });
    if (meta?.items) {
      await replaceBillItems(editingBill.id, meta.items);
    }
    setEditingBill(null);
  };

  const handleStopRecurring = async (recurringRuleId: string) => {
    setActionError(null);
    try {
      await stopRecurringMutation.mutateAsync(recurringRuleId);
      setConfirmStopRuleId(null);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Não foi possível encerrar a recorrência.",
      );
    }
  };

  const handleMarkAsPaid = async (id: string) => {
    setActionError(null);
    try {
      await markPaidMutation.mutateAsync({ id });
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Não foi possível marcar a conta como paga.",
      );
    }
  };

  const handleDelete = async (id: string) => {
    setActionError(null);
    try {
      await deleteMutation.mutateAsync(id);
      setConfirmDeleteId(null);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Não foi possível excluir a conta.",
      );
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Despesas</h1>
          <p className="text-sm text-muted-foreground">
            Cadastre, filtre e acompanhe suas despesas por mês, categoria e status.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowCsvImport((open) => !open)}
          >
            Importar CSV
          </Button>
          <Button
            type="button"
            onClick={() => {
              setEditingBill(null);
              setShowCreateForm((open) => !open);
            }}
          >
            {showCreateForm ? "Fechar formulário" : "Nova despesa"}
          </Button>
        </div>
      </div>

      {showCsvImport && (
        <CsvImportDialog
          mode="bills"
          categories={categories}
          stores={stores}
          banks={banks}
          onClose={() => setShowCsvImport(false)}
        />
      )}

      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Nova despesa</CardTitle>
            <CardDescription>Preencha os dados da despesa.</CardDescription>
          </CardHeader>
          <CardContent>
            <BillForm
              categories={categories}
              stores={stores}
              banks={banks}
              onSubmit={handleCreate}
              onCancel={() => setShowCreateForm(false)}
              isSubmitting={createMutation.isPending}
            />
          </CardContent>
        </Card>
      )}

      {editingBill && (
        <Card>
          <CardHeader>
            <CardTitle>Editar despesa</CardTitle>
            <CardDescription>Atualize os detalhes de {editingBill.description}.</CardDescription>
          </CardHeader>
          <CardContent>
            <BillForm
              key={editingBill.id}
              categories={categories}
              stores={stores}
              banks={banks}
              initialBill={editingBill}
              onSubmit={handleUpdate}
              onCancel={() => setEditingBill(null)}
              isSubmitting={updateMutation.isPending}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="filter-month">Filtrar por mês</Label>
              <Input
                id="filter-month"
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="filter-category">Filtrar por categoria</Label>
              <select
                id="filter-category"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">Todas</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="filter-status">Filtrar por status</Label>
              <select
                id="filter-status"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as BillStatusFilter)}
              >
                <option value="all">Todos</option>
                <option value="pending">Pendentes</option>
                <option value="paid">Pagas</option>
                <option value="overdue">Atrasadas</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {actionError && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {actionError}
        </p>
      )}

      {loadError && (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível carregar suas contas.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Lançamentos</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p role="status" className="text-sm text-muted-foreground">
              Carregando contas...
            </p>
          ) : bills.length === 0 ? (
            <div className="space-y-3 py-6 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhuma despesa encontrada para os filtros selecionados.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingBill(null);
                  setShowCreateForm(true);
                }}
              >
                Cadastrar primeira despesa
              </Button>
            </div>
          ) : (
            <ul className="divide-y">
              {bills.map((bill) => {
                const overdue = isBillOverdue(bill);
                const statusLabel =
                  bill.status === "paid" ? "Pago" : overdue ? "Atrasado" : "Pendente";
                const statusClass =
                  bill.status === "paid"
                    ? "bg-secondary text-secondary-foreground"
                    : overdue
                      ? "bg-destructive/15 text-destructive"
                      : "bg-muted text-foreground";

                return (
                  <li key={bill.id} className="space-y-3 py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{bill.description}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass}`}>
                            {statusLabel}
                          </span>
                          {bill.recurring_rule_id && (
                            <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                              Recorrente
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                          {bill.company && <span>{bill.company}</span>}
                          <span>{bill.category_name}</span>
                          <span>Venc.: {formatDateBR(bill.due_date)}</span>
                          <span>{PAYMENT_TYPE_LABELS[bill.payment_type]}</span>
                        </div>
                        {bill.payment_type === "debit" && (
                          <p className="text-xs text-muted-foreground">
                            {bill.bank} · Ag. {maskBankCode(bill.agency)} · Conta{" "}
                            {maskBankCode(bill.account_number)}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <span className="text-base font-semibold">
                          {formatBRL(bill.amount_cents)}
                        </span>
                        <div className="flex flex-wrap justify-end gap-2">
                          {bill.status === "pending" && (
                            <Button
                              type="button"
                              size="sm"
                              disabled={markPaidMutation.isPending}
                              onClick={() => void handleMarkAsPaid(bill.id)}
                            >
                              Marcar como pago
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setShowCreateForm(false);
                              setConfirmDeleteId(null);
                              setEditingBill(bill);
                            }}
                          >
                            Editar
                          </Button>
                          {bill.recurring_rule_id && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setConfirmDeleteId(null);
                                setConfirmStopRuleId(bill.recurring_rule_id ?? null);
                              }}
                            >
                              Encerrar recorrência
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setConfirmStopRuleId(null);
                              setConfirmDeleteId(bill.id);
                            }}
                          >
                            Excluir
                          </Button>
                        </div>
                      </div>
                    </div>

                    {bill.recurring_rule_id && confirmStopRuleId === bill.recurring_rule_id && (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/40 p-3">
                        <p className="text-sm">
                          Encerrar recorrência de <strong>{bill.description}</strong>? Os futuros
                          lançamentos pendentes serão removidos; os pagos permanecem.
                        </p>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={stopRecurringMutation.isPending}
                            onClick={() => void handleStopRecurring(bill.recurring_rule_id!)}
                          >
                            Confirmar encerramento
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setConfirmStopRuleId(null)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    )}

                    {confirmDeleteId === bill.id && (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/40 p-3">
                        <p className="text-sm">
                          Excluir a conta <strong>{bill.description}</strong>?
                        </p>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={deleteMutation.isPending}
                            onClick={() => void handleDelete(bill.id)}
                          >
                            Confirmar exclusão
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setConfirmDeleteId(null)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
