import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Bill, RecurringEditScope } from "@/features/bills/api/billsApi";
import {
  BILL_STATUSES,
  BILL_STATUS_LABELS,
  PAYMENT_TYPES,
  PAYMENT_TYPE_LABELS,
  billSchema,
  todayIsoFortaleza,
  type BillInput,
  type BillStatus,
  type PaymentType,
} from "@/features/bills/schemas/billSchema";
import type { Category } from "@/features/categories/api/categoriesApi";
import { parseBRLToCents } from "@/lib/money";

export type BillFormSubmitMeta = {
  recurring?: boolean;
  editScope?: RecurringEditScope;
};

type Props = {
  categories: Category[];
  initialBill?: Bill;
  onSubmit: (data: BillInput, meta?: BillFormSubmitMeta) => Promise<void> | void;
  onCancel?: () => void;
  isSubmitting?: boolean;
};

type FieldErrors = Partial<Record<string, string>>;

function centsToInput(cents: number): string {
  const intPart = Math.trunc(cents / 100);
  const decPart = String(Math.abs(cents % 100)).padStart(2, "0");
  return `${intPart},${decPart}`;
}

export function BillForm({
  categories,
  initialBill,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: Props) {
  const [description, setDescription] = useState(initialBill?.description ?? "");
  const [company, setCompany] = useState(initialBill?.company ?? "");
  const [categoryId, setCategoryId] = useState(
    initialBill?.category_id ?? categories[0]?.id ?? "",
  );
  const [amountText, setAmountText] = useState(
    initialBill ? centsToInput(initialBill.amount_cents) : "",
  );
  const [dueDate, setDueDate] = useState(initialBill?.due_date ?? "");
  const [paymentType, setPaymentType] = useState<PaymentType>(
    initialBill?.payment_type ?? "pix",
  );
  const [bank, setBank] = useState(initialBill?.bank ?? "");
  const [agency, setAgency] = useState(initialBill?.agency ?? "");
  const [accountNumber, setAccountNumber] = useState(initialBill?.account_number ?? "");
  const [status, setStatus] = useState<BillStatus>(initialBill?.status ?? "pending");
  const [paidAt, setPaidAt] = useState(initialBill?.paid_at ?? "");
  const [recurring, setRecurring] = useState(false);
  const [editScope, setEditScope] = useState<RecurringEditScope>("single");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isEditingRecurring = Boolean(initialBill?.recurring_rule_id);

  const handlePaymentTypeChange = (nextType: PaymentType) => {
    setPaymentType(nextType);
    if (nextType !== "debit") {
      setBank("");
      setAgency("");
      setAccountNumber("");
      setErrors((prev) => {
        const next = { ...prev };
        delete next.bank;
        delete next.agency;
        delete next.account_number;
        return next;
      });
    }
  };

  const handleStatusChange = (nextStatus: BillStatus) => {
    setStatus(nextStatus);
    if (nextStatus === "paid") {
      setPaidAt((prev) => prev || todayIsoFortaleza());
    } else {
      setPaidAt("");
    }
  };

  const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);

    const parsedCents = parseBRLToCents(amountText);
    const candidate = {
      description,
      company,
      category_id: categoryId,
      amount_cents: parsedCents ?? Number.NaN,
      payment_type: paymentType,
      bank: paymentType === "debit" ? bank : null,
      agency: paymentType === "debit" ? agency : null,
      account_number: paymentType === "debit" ? accountNumber : null,
      due_date: dueDate,
      status,
      paid_at: status === "paid" ? paidAt || todayIsoFortaleza() : null,
    };

    const result = billSchema.safeParse(candidate);
    if (!result.success) {
      const nextErrors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!nextErrors[key]) {
          nextErrors[key] = issue.message;
        }
      }
      if (parsedCents === null) {
        nextErrors.amount_cents = "Informe um valor válido em reais (ex.: 120,50).";
      }
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    try {
      if (isEditingRecurring) {
        await onSubmit(result.data, { editScope });
      } else if (!initialBill && recurring) {
        await onSubmit(result.data, { recurring: true });
      } else {
        await onSubmit(result.data);
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Não foi possível salvar a conta.");
    }
  };

  return (
    <form onSubmit={(e) => void handleFormSubmit(e)} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="bill-description">Descrição *</Label>
          <Input
            id="bill-description"
            maxLength={120}
            value={description}
            aria-invalid={Boolean(errors.description)}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex.: Aluguel, Internet, Supermercado"
          />
          {errors.description && <p className="text-sm text-destructive">{errors.description}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bill-company">Empresa</Label>
          <Input
            id="bill-company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Opcional"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bill-category">Categoria *</Label>
          <select
            id="bill-category"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={categoryId}
            aria-invalid={Boolean(errors.category_id)}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {categories.length === 0 && <option value="">Nenhuma categoria disponível</option>}
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          {errors.category_id && <p className="text-sm text-destructive">{errors.category_id}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bill-amount">Valor (R$) *</Label>
          <Input
            id="bill-amount"
            inputMode="decimal"
            value={amountText}
            aria-invalid={Boolean(errors.amount_cents)}
            onChange={(e) => setAmountText(e.target.value)}
            placeholder="0,00"
          />
          {errors.amount_cents && (
            <p className="text-sm text-destructive">{errors.amount_cents}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bill-due-date">Vencimento *</Label>
          <Input
            id="bill-due-date"
            type="date"
            value={dueDate}
            aria-invalid={Boolean(errors.due_date)}
            onChange={(e) => setDueDate(e.target.value)}
          />
          {errors.due_date && <p className="text-sm text-destructive">{errors.due_date}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bill-payment-type">Tipo de pagamento *</Label>
          <select
            id="bill-payment-type"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={paymentType}
            onChange={(e) => handlePaymentTypeChange(e.target.value as PaymentType)}
          >
            {PAYMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {PAYMENT_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bill-status">Status *</Label>
          <select
            id="bill-status"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={status}
            onChange={(e) => handleStatusChange(e.target.value as BillStatus)}
          >
            {BILL_STATUSES.map((item) => (
              <option key={item} value={item}>
                {BILL_STATUS_LABELS[item]}
              </option>
            ))}
          </select>
        </div>

        {status === "paid" && (
          <div className="space-y-1.5">
            <Label htmlFor="bill-paid-at">Data de pagamento</Label>
            <Input
              id="bill-paid-at"
              type="date"
              value={paidAt}
              aria-invalid={Boolean(errors.paid_at)}
              onChange={(e) => setPaidAt(e.target.value)}
            />
            {errors.paid_at && <p className="text-sm text-destructive">{errors.paid_at}</p>}
          </div>
        )}
      </div>

      {paymentType === "debit" && (
        <div className="grid gap-4 rounded-md border bg-muted/30 p-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="bill-bank">Banco *</Label>
            <Input
              id="bill-bank"
              value={bank}
              aria-invalid={Boolean(errors.bank)}
              onChange={(e) => setBank(e.target.value)}
            />
            {errors.bank && <p className="text-sm text-destructive">{errors.bank}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bill-agency">Agência *</Label>
            <Input
              id="bill-agency"
              value={agency}
              aria-invalid={Boolean(errors.agency)}
              onChange={(e) => setAgency(e.target.value)}
            />
            {errors.agency && <p className="text-sm text-destructive">{errors.agency}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bill-account">Conta *</Label>
            <Input
              id="bill-account"
              value={accountNumber}
              aria-invalid={Boolean(errors.account_number)}
              onChange={(e) => setAccountNumber(e.target.value)}
            />
            {errors.account_number && (
              <p className="text-sm text-destructive">{errors.account_number}</p>
            )}
          </div>
        </div>
      )}

      {!initialBill && (
        <div className="flex items-center gap-2">
          <input
            id="bill-recurring"
            type="checkbox"
            className="h-4 w-4 rounded border-input"
            checked={recurring}
            onChange={(e) => setRecurring(e.target.checked)}
          />
          <Label htmlFor="bill-recurring" className="font-normal">
            Recorrente (gerar automaticamente todo mês)
          </Label>
        </div>
      )}

      {isEditingRecurring && (
        <fieldset className="space-y-2 rounded-md border bg-muted/30 p-3">
          <legend className="px-1 text-sm font-medium">Aplicar alterações em</legend>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="recurring-edit-scope"
                value="single"
                checked={editScope === "single"}
                onChange={() => setEditScope("single")}
              />
              Só este lançamento
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="recurring-edit-scope"
                value="future"
                checked={editScope === "future"}
                onChange={() => setEditScope("future")}
              />
              Este e os futuros pendentes
            </label>
          </div>
        </fieldset>
      )}

      {submitError && (
        <p role="alert" className="text-sm text-destructive">
          {submitError}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : "Salvar conta"}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
