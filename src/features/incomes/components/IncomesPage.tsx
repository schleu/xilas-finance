import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { formatBRL, parseBRLToCents } from "@/lib/money";

function centsToInput(cents: number): string {
  const intPart = Math.trunc(cents / 100);
  const decPart = String(Math.abs(cents % 100)).padStart(2, "0");
  return `${intPart},${decPart}`;
}

export function IncomesPage() {
  const [month, setMonth] = useState(currentMonthFortaleza);
  const [natureFilter, setNatureFilter] = useState<IncomeNature | "all">("all");
  const [typeFilter, setTypeFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [editingIncome, setEditingIncome] = useState<IncomeWithRelations | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
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

  const resolvedTypeId = incomeTypeId || incomeTypes[0]?.id || "";
  const totalMonthCents = incomes.reduce((sum, item) => sum + item.amount_cents, 0);

  const resetForm = () => {
    setDescription("");
    setAmountText("");
    setReceivedDate(todayIsoFortaleza());
    setNature("fixed");
    setIncomeTypeId("");
    setBankId("");
    setEditingIncome(null);
    setShowForm(false);
    setActionError(null);
  };

  const startEdit = (income: IncomeWithRelations) => {
    setActionError(null);
    setConfirmDeleteId(null);
    setEditingIncome(income);
    setDescription(income.description);
    setAmountText(centsToInput(income.amount_cents));
    setReceivedDate(income.received_date);
    setNature(income.nature);
    setIncomeTypeId(income.income_type_id);
    setBankId(income.bank_id ?? "");
    setShowForm(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setActionError(null);

    const parsedCents = parseBRLToCents(amountText);
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
      setConfirmDeleteId(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Não foi possível excluir a renda.");
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Rendas</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe suas entradas fixas e variáveis, tipos de renda e banco depositado.
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
              if (showForm) {
                resetForm();
              } else {
                setEditingIncome(null);
                setShowForm(true);
              }
            }}
          >
            {showForm ? "Fechar formulário" : "Nova renda"}
          </Button>
        </div>
      </div>

      {showCsvImport && (
        <CsvImportDialog
          mode="incomes"
          incomeTypes={incomeTypes}
          banks={banks}
          onClose={() => setShowCsvImport(false)}
        />
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingIncome ? "Editar renda" : "Nova renda"}</CardTitle>
            <CardDescription>Preencha os dados da entrada financeira.</CardDescription>
          </CardHeader>
          <CardContent>
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

              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingIncome ? "Salvar renda" : "Cadastrar renda"}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {actionError && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {actionError}
        </p>
      )}

      {loadError && (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível carregar suas rendas.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
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
        </CardContent>
      </Card>

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
          ) : incomes.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma renda encontrada para os filtros selecionados.
            </p>
          ) : (
            <ul className="divide-y">
              {incomes.map((income) => (
                <li key={income.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{income.description}</span>
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                          {INCOME_NATURE_LABELS[income.nature]}
                        </span>
                        <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                          {income.income_type_name}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                        <span>Data: {formatDateBR(income.received_date)}</span>
                        {income.bank_name && <span>Banco: {income.bank_name}</span>}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <span className="text-base font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatBRL(income.amount_cents)}
                      </span>
                      <div className="flex gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => startEdit(income)}>
                          Editar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => setConfirmDeleteId(income.id)}
                        >
                          Excluir
                        </Button>
                      </div>
                    </div>
                  </div>

                  {confirmDeleteId === income.id && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/40 p-2.5 text-sm">
                      <span>
                        Excluir a renda <strong>{income.description}</strong>?
                      </span>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={deleteMutation.isPending}
                          onClick={() => void handleDelete(income.id)}
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
              ))}
            </ul>
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
                    onClick={() => void deleteTypeMutation.mutateAsync(type.id).catch((err) => {
                      setActionError(err instanceof Error ? err.message : "Erro ao excluir tipo.");
                    })}
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
