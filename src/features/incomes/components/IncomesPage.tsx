import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Filter,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { currentMonthFortaleza, todayIsoFortaleza } from "@/features/bills/schemas/billSchema";
import { CsvImportDialog } from "@/features/csvImport/components/CsvImportDialog";
import type { IncomeWithRelations } from "@/features/incomes/api/incomesApi";
import {
  useCreateIncome,
  useCreateIncomeType,
  useDeleteIncome,
  useDeleteIncomeType,
  useIncomes,
  useIncomeTypes,
  useUpdateIncome,
} from "@/features/incomes/hooks/useIncomes";
import {
  INCOME_NATURES,
  INCOME_NATURE_LABELS,
  incomeSchema,
  incomeTypeSchema,
  type IncomeNature,
} from "@/features/incomes/schemas/incomeSchema";
import { formatDateBR } from "@/lib/dates";
import { centsToBRInput, formatBRL, normalizeDecimalInput, parseBRLToCents } from "@/lib/money";
import { useTableSort } from "@/lib/tableSort";

type IncomeSortKey =
  | "description"
  | "nature"
  | "income_type_name"
  | "received_date"
  | "bank_name"
  | "amount_cents";

function SortIcon({ active, direction }: { active: boolean; direction?: "asc" | "desc" }) {
  if (!active) return <ArrowUpDown className="ml-1 inline h-3.5 w-3.5 opacity-50" aria-hidden="true" />;
  return direction === "asc" ? (
    <ArrowUp className="ml-1 inline h-3.5 w-3.5" aria-hidden="true" />
  ) : (
    <ArrowDown className="ml-1 inline h-3.5 w-3.5" aria-hidden="true" />
  );
}

export function IncomesPage() {
  const defaultMonth = currentMonthFortaleza();
  const [month, setMonth] = useState(defaultMonth);
  const [natureFilter, setNatureFilter] = useState<IncomeNature | "all">("all");
  const [typeFilter, setTypeFilter] = useState("");
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [editingIncome, setEditingIncome] = useState<IncomeWithRelations | null>(null);
  const [deletingIncome, setDeletingIncome] = useState<IncomeWithRelations | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Form state
  const [description, setDescription] = useState("");
  const [amountText, setAmountText] = useState("");
  const [receivedDate, setReceivedDate] = useState(todayIsoFortaleza);
  const [nature, setNature] = useState<IncomeNature>("fixed");
  const [incomeTypeId, setIncomeTypeId] = useState("");
  const [bankId, setBankId] = useState("");
  const [newTypeName, setNewTypeName] = useState("");

  const { data: incomeTypes = [] } = useIncomeTypes();
  const { data: banks = [] } = useBanks();
  const {
    data: incomes = [],
    isLoading,
    error: loadError,
  } = useIncomes({
    month: month || undefined,
    nature: natureFilter,
    incomeTypeId: typeFilter || undefined,
  });

  const createMutation = useCreateIncome();
  const updateMutation = useUpdateIncome();
  const deleteMutation = useDeleteIncome();
  const createTypeMutation = useCreateIncomeType();
  const deleteTypeMutation = useDeleteIncomeType();

  const sortAccessors = useMemo(
    () => ({
      description: (i: IncomeWithRelations) => i.description,
      nature: (i: IncomeWithRelations) => INCOME_NATURE_LABELS[i.nature],
      income_type_name: (i: IncomeWithRelations) => i.income_type_name,
      received_date: (i: IncomeWithRelations) => i.received_date,
      bank_name: (i: IncomeWithRelations) => i.bank_name ?? "",
      amount_cents: (i: IncomeWithRelations) => i.amount_cents,
    }),
    [],
  );

  const { sort, sortedRows: sortedIncomes, toggleSort, getAriaSort } = useTableSort<
    IncomeWithRelations,
    IncomeSortKey
  >(incomes, sortAccessors);

  const resolvedTypeId = incomeTypeId || incomeTypes[0]?.id || "";
  const totalMonthCents = incomes.reduce((sum, item) => sum + item.amount_cents, 0);
  const hasCustomFilters =
    month !== defaultMonth || natureFilter !== "all" || typeFilter !== "";

  const clearFilters = () => {
    setMonth(defaultMonth);
    setNatureFilter("all");
    setTypeFilter("");
  };

  const resetForm = () => {
    setDescription("");
    setAmountText("");
    setReceivedDate(todayIsoFortaleza());
    setNature("fixed");
    setIncomeTypeId("");
    setBankId("");
    setEditingIncome(null);
    setShowFormModal(false);
    setActionError(null);
  };

  const openCreateModal = () => {
    setDescription("");
    setAmountText("");
    setReceivedDate(todayIsoFortaleza());
    setNature("fixed");
    setIncomeTypeId("");
    setBankId("");
    setEditingIncome(null);
    setActionError(null);
    setShowFormModal(true);
  };

  const startEdit = (income: IncomeWithRelations) => {
    setActionError(null);
    setEditingIncome(income);
    setDescription(income.description);
    setAmountText(centsToBRInput(income.amount_cents));
    setReceivedDate(income.received_date);
    setNature(income.nature);
    setIncomeTypeId(income.income_type_id);
    setBankId(income.bank_id ?? "");
    setShowFormModal(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setActionError(null);

    const parsedCents = parseBRLToCents(normalizeDecimalInput(amountText));
    const parsed = incomeSchema.safeParse({
      description,
      amount_cents: parsedCents ?? Number.NaN,
      received_date: receivedDate,
      nature,
      income_type_id: resolvedTypeId,
      bank_id: bankId || null,
    });

    if (!parsed.success) {
      setActionError(parsed.error.issues[0]?.message ?? "Verifique os campos da renda.");
      return;
    }

    try {
      if (editingIncome) {
        await updateMutation.mutateAsync({ id: editingIncome.id, input: parsed.data });
      } else {
        await createMutation.mutateAsync(parsed.data);
      }
      resetForm();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Não foi possível salvar a renda.");
    }
  };

  const handleCreateType = async (event: React.FormEvent) => {
    event.preventDefault();
    setActionError(null);
    const parsed = incomeTypeSchema.safeParse({ name: newTypeName });
    if (!parsed.success) {
      setActionError(parsed.error.issues[0]?.message ?? "Nome inválido.");
      return;
    }
    try {
      await createTypeMutation.mutateAsync(parsed.data.name);
      setNewTypeName("");
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Não foi possível criar o tipo de renda.",
      );
    }
  };

  const handleDelete = async (id: string) => {
    setActionError(null);
    try {
      await deleteMutation.mutateAsync(id);
      setDeletingIncome(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Não foi possível excluir a renda.");
    }
  };

  const renderSortHeader = (key: IncomeSortKey, label: string, alignRight = false) => (
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
          <h1 className="text-2xl font-semibold">Rendas</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe suas entradas fixas e variáveis, tipos de renda e banco depositado.
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
          <Button type="button" onClick={openCreateModal}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nova renda
          </Button>
        </div>
      </div>

      {showCsvImport && (
        <CsvImportDialog
          open={showCsvImport}
          mode="incomes"
          incomeTypes={incomeTypes}
          banks={banks}
          onClose={() => setShowCsvImport(false)}
        />
      )}

      {/* Modal: Nova / Editar renda */}
      <Dialog
        open={showFormModal}
        onOpenChange={(open) => {
          if (!open) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingIncome ? "Editar renda" : "Nova renda"}</DialogTitle>
            <DialogDescription>Preencha os dados da entrada financeira.</DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => void handleSubmit(e)} className="grid gap-4 sm:grid-cols-2" noValidate>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="income-description">Descrição *</Label>
              <Input
                id="income-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex.: Salário mensal, Projeto freela"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="income-amount">Valor (R$) *</Label>
              <Input
                id="income-amount"
                inputMode="decimal"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                onBlur={() => setAmountText((prev) => normalizeDecimalInput(prev))}
                placeholder="0,00"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="income-date">Data *</Label>
              <Input
                id="income-date"
                type="date"
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="income-nature">Natureza *</Label>
              <select
                id="income-nature"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={nature}
                onChange={(e) => setNature(e.target.value as IncomeNature)}
              >
                {INCOME_NATURES.map((n) => (
                  <option key={n} value={n}>
                    {INCOME_NATURE_LABELS[n]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="income-type">Tipo de renda *</Label>
              <select
                id="income-type"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={resolvedTypeId}
                onChange={(e) => setIncomeTypeId(e.target.value)}
              >
                {incomeTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="income-bank">Banco depositado</Label>
              <select
                id="income-bank"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={bankId}
                onChange={(e) => setBankId(e.target.value)}
              >
                <option value="">Selecionar banco (opcional)</option>
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {actionError && (
              <p role="alert" className="text-sm text-destructive sm:col-span-2">
                {actionError}
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingIncome ? "Salvar renda" : "Cadastrar renda"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Filtros */}
      <Dialog open={showFiltersModal} onOpenChange={setShowFiltersModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Filtrar rendas</DialogTitle>
            <DialogDescription>
              Escolha mês, natureza e tipo de renda para refinar os lançamentos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="income-filter-month">Mês</Label>
              <Input
                id="income-filter-month"
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="income-filter-nature">Natureza</Label>
              <select
                id="income-filter-nature"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={natureFilter}
                onChange={(e) => setNatureFilter(e.target.value as IncomeNature | "all")}
              >
                <option value="all">Todas</option>
                <option value="fixed">Fixa</option>
                <option value="variable">Variável</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="income-filter-type">Tipo</Label>
              <select
                id="income-filter-type"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="">Todos</option>
                {incomeTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
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
        open={Boolean(deletingIncome)}
        onOpenChange={(open) => {
          if (!open) setDeletingIncome(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir renda</DialogTitle>
            <DialogDescription>
              Deseja realmente excluir a renda <strong>{deletingIncome?.description}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeletingIncome(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deletingIncome && void handleDelete(deletingIncome.id)}
            >
              Confirmar exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {actionError && !showFormModal && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {actionError}
        </p>
      )}

      {loadError && (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível carregar suas rendas.
        </p>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>Lançamentos de renda</CardTitle>
            <CardDescription>Total filtrado: {formatBRL(totalMonthCents)}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p role="status" className="text-sm text-muted-foreground">
              Carregando rendas...
            </p>
          ) : sortedIncomes.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma renda encontrada para os filtros selecionados.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {renderSortHeader("description", "Descrição")}
                  {renderSortHeader("nature", "Natureza")}
                  {renderSortHeader("income_type_name", "Tipo")}
                  {renderSortHeader("received_date", "Data")}
                  {renderSortHeader("bank_name", "Banco")}
                  {renderSortHeader("amount_cents", "Valor", true)}
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedIncomes.map((income) => (
                  <TableRow key={income.id}>
                    <TableCell className="font-medium">{income.description}</TableCell>
                    <TableCell>
                      <span className="inline-flex rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                        {INCOME_NATURE_LABELS[income.nature]}
                      </span>
                    </TableCell>
                    <TableCell>{income.income_type_name}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDateBR(income.received_date)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {income.bank_name || "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold whitespace-nowrap text-emerald-600 dark:text-emerald-400">
                      {formatBRL(income.amount_cents)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center justify-end gap-1">
                        <IconTooltipButton
                          label="Editar"
                          icon={<Pencil className="h-4 w-4" aria-hidden="true" />}
                          onClick={() => startEdit(income)}
                        />
                        <IconTooltipButton
                          label="Excluir"
                          icon={<Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />}
                          onClick={() => setDeletingIncome(income)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tipos de renda</CardTitle>
          <CardDescription>
            Salário, Freela e Outros vêm prontos; você pode adicionar outros tipos abaixo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={(e) => void handleCreateType(e)} className="flex flex-wrap gap-2">
            <Label htmlFor="new-income-type" className="sr-only">
              Novo tipo de renda
            </Label>
            <Input
              id="new-income-type"
              className="flex-1"
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              placeholder="Ex.: Dividendos, Aluguel recebido"
            />
            <Button type="submit" size="sm" disabled={createTypeMutation.isPending}>
              Adicionar tipo
            </Button>
          </form>

          <div className="flex flex-wrap gap-2">
            {incomeTypes.map((type) => (
              <span
                key={type.id}
                className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1 text-xs"
              >
                {type.name}
                {!type.is_default && (
                  <button
                    type="button"
                    aria-label={`Excluir tipo ${type.name}`}
                    className="text-destructive hover:underline"
                    onClick={() =>
                      void deleteTypeMutation.mutateAsync(type.id).catch((err) => {
                        setActionError(err instanceof Error ? err.message : "Erro ao excluir tipo.");
                      })
                    }
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
