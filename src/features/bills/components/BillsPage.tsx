import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Ban,
  CheckCircle2,
  Filter,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IconTooltipButton } from "@/components/ui/icon-tooltip-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useBanks } from "@/features/banks/hooks/useBanks";
import { replaceBillItems } from "@/features/bills/api/billItemsApi";
import type { BillStatusFilter, BillWithCategory } from "@/features/bills/api/billsApi";
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
  formatReferenceMonthBR,
  isBillOverdue,
  maskBankCode,
  type BillInput,
} from "@/features/bills/schemas/billSchema";
import { useCategories } from "@/features/categories/hooks/useCategories";
import { CsvImportDialog } from "@/features/csvImport/components/CsvImportDialog";
import { useStores } from "@/features/stores/hooks/useStores";
import { formatDateBR } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { useTableSort } from "@/lib/tableSort";

type BillSortKey =
  | "description"
  | "company"
  | "category_name"
  | "reference_month"
  | "due_date"
  | "payment_type"
  | "status"
  | "amount_cents";

function SortIcon({ active, direction }: { active: boolean; direction?: "asc" | "desc" }) {
  if (!active) return <ArrowUpDown className="ml-1 inline h-3.5 w-3.5 opacity-50" aria-hidden="true" />;
  return direction === "asc" ? (
    <ArrowUp className="ml-1 inline h-3.5 w-3.5" aria-hidden="true" />
  ) : (
    <ArrowDown className="ml-1 inline h-3.5 w-3.5" aria-hidden="true" />
  );
}

export function BillsPage() {
  const defaultMonth = currentMonthFortaleza();
  const [month, setMonth] = useState(defaultMonth);
  const [categoryId, setCategoryId] = useState("");
  const [statusFilter, setStatusFilter] = useState<BillStatusFilter>("all");
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [editingBill, setEditingBill] = useState<BillWithCategory | null>(null);
  const [deletingBill, setDeletingBill] = useState<BillWithCategory | null>(null);
  const [stoppingRuleBill, setStoppingRuleBill] = useState<BillWithCategory | null>(null);
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

  const sortAccessors = useMemo(
    () => ({
      description: (b: BillWithCategory) => b.description,
      company: (b: BillWithCategory) => b.company ?? "",
      category_name: (b: BillWithCategory) => b.category_name,
      reference_month: (b: BillWithCategory) => b.reference_month ?? `${b.due_date.slice(0, 7)}-01`,
      due_date: (b: BillWithCategory) => b.due_date,
      payment_type: (b: BillWithCategory) => PAYMENT_TYPE_LABELS[b.payment_type],
      status: (b: BillWithCategory) =>
        b.status === "paid" ? "Pago" : isBillOverdue(b) ? "Atrasado" : "Pendente",
      amount_cents: (b: BillWithCategory) => b.amount_cents,
    }),
    [],
  );

  const { sort, sortedRows: sortedBills, toggleSort, getAriaSort } = useTableSort<
    BillWithCategory,
    BillSortKey
  >(bills, sortAccessors);

  const hasCustomFilters =
    month !== defaultMonth || categoryId !== "" || statusFilter !== "all";

  const clearFilters = () => {
    setMonth(defaultMonth);
    setCategoryId("");
    setStatusFilter("all");
  };

  const handleCreate = async (input: BillInput, meta?: BillFormSubmitMeta) => {
    setActionError(null);
    const created = await createMutation.mutateAsync({ input, recurring: meta?.recurring });
    if (meta?.items && meta.items.length > 0 && created?.id) {
      await replaceBillItems(created.id, meta.items);
    }
    setShowCreateModal(false);
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
      setStoppingRuleBill(null);
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
      setDeletingBill(null);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Não foi possível excluir a conta.",
      );
    }
  };

  const renderSortHeader = (key: BillSortKey, label: string, alignRight = false) => (
    <TableHead aria-sort={getAriaSort(key)} className={alignRight ? "text-right" : undefined}>
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className={[
          "inline-flex items-center font-medium hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xs",
          alignRight ? "ml-auto" : "",
        ].join(" ")}
      >
        {label}
        <SortIcon active={sort?.key === key} direction={sort?.direction} />
      </button>
    </TableHead>
  );

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Despesas</h1>
          <p className="text-sm text-muted-foreground">
            Cadastre, filtre e acompanhe suas despesas por mês, categoria e status.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => setShowFiltersModal(true)}>
            <Filter className="h-4 w-4" aria-hidden="true" />
            Filtros
          </Button>
          {hasCustomFilters && (
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4" aria-hidden="true" />
              Limpar filtros
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => setShowCsvImport(true)}>
            <Upload className="h-4 w-4" aria-hidden="true" />
            Importar
          </Button>
          <Button
            type="button"
            onClick={() => {
              setEditingBill(null);
              setShowCreateModal(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nova despesa
          </Button>
        </div>
      </div>

      {showCsvImport && (
        <CsvImportDialog
          open={showCsvImport}
          mode="bills"
          categories={categories}
          stores={stores}
          banks={banks}
          onClose={() => setShowCsvImport(false)}
        />
      )}

      {/* Modal: Nova / Editar despesa */}
      <Dialog
        open={showCreateModal || Boolean(editingBill)}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateModal(false);
            setEditingBill(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingBill ? "Editar despesa" : "Nova despesa"}</DialogTitle>
            <DialogDescription>
              {editingBill
                ? `Atualize os detalhes de ${editingBill.description}.`
                : "Preencha os dados da despesa."}
            </DialogDescription>
          </DialogHeader>
          {editingBill ? (
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
          ) : (
            <BillForm
              categories={categories}
              stores={stores}
              banks={banks}
              onSubmit={handleCreate}
              onCancel={() => setShowCreateModal(false)}
              isSubmitting={createMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Filtros */}
      <Dialog open={showFiltersModal} onOpenChange={setShowFiltersModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Filtrar despesas</DialogTitle>
            <DialogDescription>
              Escolha mês de referência, categoria e status para refinar a listagem.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={clearFilters}>
              Limpar filtros
            </Button>
            <Button type="button" onClick={() => setShowFiltersModal(false)}>
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Confirmar exclusão */}
      <Dialog
        open={Boolean(deletingBill)}
        onOpenChange={(open) => {
          if (!open) setDeletingBill(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir despesa</DialogTitle>
            <DialogDescription>
              Deseja realmente excluir a despesa <strong>{deletingBill?.description}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeletingBill(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deletingBill && void handleDelete(deletingBill.id)}
            >
              Confirmar exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Confirmar encerramento de recorrência */}
      <Dialog
        open={Boolean(stoppingRuleBill)}
        onOpenChange={(open) => {
          if (!open) setStoppingRuleBill(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Encerrar recorrência</DialogTitle>
            <DialogDescription>
              Encerrar recorrência de <strong>{stoppingRuleBill?.description}</strong>? Os futuros
              lançamentos pendentes serão removidos; os pagos permanecem.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setStoppingRuleBill(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={stopRecurringMutation.isPending}
              onClick={() =>
                stoppingRuleBill?.recurring_rule_id &&
                void handleStopRecurring(stoppingRuleBill.recurring_rule_id)
              }
            >
              Confirmar encerramento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
          ) : sortedBills.length === 0 ? (
            <div className="space-y-3 py-6 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhuma despesa encontrada para os filtros selecionados.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingBill(null);
                  setShowCreateModal(true);
                }}
              >
                Registrar primeira despesa
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {renderSortHeader("description", "Descrição")}
                  {renderSortHeader("company", "Empresa / Loja")}
                  {renderSortHeader("category_name", "Categoria")}
                  {renderSortHeader("reference_month", "Mês Ref.")}
                  {renderSortHeader("due_date", "Vencimento")}
                  {renderSortHeader("payment_type", "Pagamento")}
                  {renderSortHeader("status", "Status")}
                  {renderSortHeader("amount_cents", "Valor", true)}
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedBills.map((bill) => {
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
                    <TableRow key={bill.id}>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium">{bill.description}</span>
                          {bill.recurring_rule_id && (
                            <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                              Recorrente
                            </span>
                          )}
                        </div>
                        {bill.payment_type === "debit" && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {bill.bank} · Ag. {maskBankCode(bill.agency)} · Conta{" "}
                            {maskBankCode(bill.account_number)}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {bill.company || "—"}
                      </TableCell>
                      <TableCell>{bill.category_name}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatReferenceMonthBR(bill.reference_month ?? bill.due_date)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDateBR(bill.due_date)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {PAYMENT_TYPE_LABELS[bill.payment_type]}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${statusClass}`}>
                          {statusLabel}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-semibold whitespace-nowrap">
                        {formatBRL(bill.amount_cents)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          {bill.status === "pending" && (
                            <IconTooltipButton
                              label="Marcar como pago"
                              icon={
                                <CheckCircle2
                                  className="h-4 w-4 text-emerald-600 dark:text-emerald-400"
                                  aria-hidden="true"
                                />
                              }
                              disabled={markPaidMutation.isPending}
                              onClick={() => void handleMarkAsPaid(bill.id)}
                            />
                          )}
                          <IconTooltipButton
                            label="Editar"
                            icon={<Pencil className="h-4 w-4" aria-hidden="true" />}
                            onClick={() => {
                              setShowCreateModal(false);
                              setEditingBill(bill);
                            }}
                          />
                          {bill.recurring_rule_id && (
                            <IconTooltipButton
                              label="Encerrar recorrência"
                              icon={<Ban className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />}
                              onClick={() => setStoppingRuleBill(bill)}
                            />
                          )}
                          <IconTooltipButton
                            label="Excluir"
                            icon={<Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />}
                            onClick={() => setDeletingBill(bill)}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
