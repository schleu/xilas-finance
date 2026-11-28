import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Bank } from "@/features/banks/api/banksApi";
import type { Bill, RecurringEditScope } from "@/features/bills/api/billsApi";
import { StoreAutocomplete } from "@/features/bills/components/StoreAutocomplete";
import {
  SupermarketItemsSection,
  draftSubItemsToInputs,
  type DraftSubItem,
} from "@/features/bills/components/SupermarketItemsSection";
import type {
  BillItemInput,
  SupermarketPaymentMethod,
} from "@/features/bills/schemas/billItemSchema";
import {
  BILL_STATUSES,
  BILL_STATUS_LABELS,
  PAYMENT_TYPES,
  PAYMENT_TYPE_LABELS,
  billSchema,
  currentMonthFortaleza,
  maskBankCode,
  todayIsoFortaleza,
  type BillInput,
  type BillStatus,
  type PaymentType,
} from "@/features/bills/schemas/billSchema";
import type { Category } from "@/features/categories/api/categoriesApi";
import type { Store } from "@/features/stores/api/storesApi";
import { clampDueDate } from "@/lib/dates";
import { centsToBRInput, normalizeDecimalInput, parseBRLToCents } from "@/lib/money";

export type BillFormSubmitMeta = {
  recurring?: boolean;
  editScope?: RecurringEditScope;
  items?: BillItemInput[];
};

type Props = {
  categories: Category[];
  stores?: Store[];
  banks?: Bank[];
  initialBill?: Bill;
  onSubmit: (data: BillInput, meta?: BillFormSubmitMeta) => Promise<void> | void;
  onCancel?: () => void;
  isSubmitting?: boolean;
};

type FieldErrors = Partial<Record<string, string>>;

export function BillForm({
  categories,
  stores = [],
  banks = [],
  initialBill,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: Props) {
  const [description, setDescription] = useState(initialBill?.description ?? "");
  const [company, setCompany] = useState(initialBill?.company ?? "");
  const [storeId, setStoreId] = useState(initialBill?.store_id ?? "");
  const [categoryId, setCategoryId] = useState(
    initialBill?.category_id ?? categories[0]?.id ?? "",
  );
  const [amountText, setAmountText] = useState(
    initialBill ? centsToBRInput(initialBill.amount_cents) : "",
  );
  const [dueDate, setDueDate] = useState(initialBill?.due_date ?? todayIsoFortaleza());
  const [referenceMonth, setReferenceMonth] = useState(
    initialBill?.reference_month ? initialBill.reference_month.slice(0, 7) : "",
  );
  const [paymentType, setPaymentType] = useState<PaymentType>(
    initialBill?.payment_type ?? "pix",
  );
  const [bankId, setBankId] = useState(initialBill?.bank_id ?? "");
  const [bank, setBank] = useState(initialBill?.bank ?? "");
  const [agency, setAgency] = useState(initialBill?.agency ?? "");
  const [accountNumber, setAccountNumber] = useState(initialBill?.account_number ?? "");
  const [status, setStatus] = useState<BillStatus>(initialBill?.status ?? "pending");
  const [paidAt, setPaidAt] = useState(initialBill?.paid_at ?? "");
  const [recurring, setRecurring] = useState(false);
  const [editScope, setEditScope] = useState<RecurringEditScope>("single");
  const [supermarketPayment, setSupermarketPayment] = useState<SupermarketPaymentMethod>(
    (initialBill?.supermarket_payment_method as SupermarketPaymentMethod | null) ?? "credit",
  );
  const [nfeUrl, setNfeUrl] = useState(initialBill?.nfe_url ?? "");
  const [subItems, setSubItems] = useState<DraftSubItem[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isEditingRecurring = Boolean(initialBill?.recurring_rule_id);
  const selectedCategory = categories.find((c) => c.id === categoryId);
  const isSupermarket = selectedCategory?.name.trim().toLowerCase() === "supermercado";
  const debitBanks = banks.filter((b) => b.has_debit_account);
  const creditBanks = banks.filter((b) => b.has_credit_card);

  const handleDebitBankSelect = (nextBankId: string) => {
    setBankId(nextBankId);
    const matched = debitBanks.find((b) => b.id === nextBankId);
    if (matched) {
      setBank(matched.name);
      setAgency(matched.agency ?? "");
      setAccountNumber(matched.account_number ?? "");
    }
  };

  const handleCreditBankSelect = (nextBankId: string) => {
    setBankId(nextBankId);
    const matched = creditBanks.find((b) => b.id === nextBankId);
    if (matched?.credit_card_due_day && !dueDate) {
      const [yearStr, monthStr] = currentMonthFortaleza().split("-");
      setDueDate(clampDueDate(Number(yearStr), Number(monthStr), matched.credit_card_due_day));
    }
  };

  const handlePaymentTypeChange = (nextType: PaymentType) => {
    setPaymentType(nextType);
    setBankId("");
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

    const normalizedAmount = normalizeDecimalInput(amountText);
    const parsedCents = parseBRLToCents(normalizedAmount);
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
      reference_month: referenceMonth || null,
      status,
      paid_at: status === "paid" ? paidAt || todayIsoFortaleza() : null,
      ...(storeId ? { store_id: storeId } : {}),
      ...(bankId ? { bank_id: bankId } : {}),
      ...(isSupermarket
        ? { supermarket_payment_method: supermarketPayment, nfe_url: nfeUrl || null }
        : {}),
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
    const parsedItems = isSupermarket ? draftSubItemsToInputs(subItems) : [];
    try {
      if (isEditingRecurring) {
        await onSubmit(
          result.data,
          parsedItems.length > 0 ? { editScope, items: parsedItems } : { editScope },
        );
      } else if (!initialBill && recurring) {
        await onSubmit(
          result.data,
          parsedItems.length > 0 ? { recurring: true, items: parsedItems } : { recurring: true },
        );
      } else if (parsedItems.length > 0) {
        await onSubmit(result.data, { items: parsedItems });
      } else {
        await onSubmit(result.data);
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Não foi possível salvar a despesa.");
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
          <Label htmlFor="bill-company">Empresa / Loja</Label>
          <StoreAutocomplete
            id="bill-company"
            value={company}
            stores={stores}
            placeholder="Opcional"
            onChange={(nextCompany, matchedId) => {
              setCompany(nextCompany);
              setStoreId(matchedId);
            }}
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
            onBlur={() => setAmountText((prev) => normalizeDecimalInput(prev))}
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
          <Label htmlFor="bill-reference-month">Mês/Ano de referência</Label>
          <Input
            id="bill-reference-month"
            type="month"
            value={referenceMonth}
            aria-invalid={Boolean(errors.reference_month)}
            onChange={(e) => setReferenceMonth(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Opcional: se vazio, usa o mês do vencimento.
          </p>
          {errors.reference_month && (
            <p className="text-sm text-destructive">{errors.reference_month}</p>
          )}
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

      {paymentType === "credit" && creditBanks.length > 0 && (
        <div className="space-y-1.5 rounded-md border bg-muted/30 p-4">
          <Label htmlFor="bill-credit-bank">Cartão de crédito cadastrado</Label>
          <select
            id="bill-credit-bank"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={bankId}
            onChange={(e) => handleCreditBankSelect(e.target.value)}
          >
            <option value="">Selecionar cartão (opcional)</option>
            {creditBanks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
                {b.credit_card_label ? ` (${b.credit_card_label})` : ""} — vence dia{" "}
                {b.credit_card_due_day}
              </option>
            ))}
          </select>
        </div>
      )}

      {paymentType === "debit" && (
        <div className="space-y-3 rounded-md border bg-muted/30 p-4">
          {debitBanks.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="bill-debit-bank">Conta bancária cadastrada</Label>
              <select
                id="bill-debit-bank"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={bankId}
                onChange={(e) => handleDebitBankSelect(e.target.value)}
              >
                <option value="">Informar manualmente</option>
                {debitBanks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} · Ag. {maskBankCode(b.agency)} · Conta {maskBankCode(b.account_number)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
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
        </div>
      )}

      {isSupermarket && (
        <SupermarketItemsSection
          supermarketPayment={supermarketPayment}
          onSupermarketPaymentChange={setSupermarketPayment}
          nfeUrl={nfeUrl}
          onNfeUrlChange={setNfeUrl}
          items={subItems}
          onItemsChange={setSubItems}
          billAmountCents={parseBRLToCents(amountText)}
          onApplySumToBillTotal={(sumCents) => setAmountText(centsToBRInput(sumCents))}
          onNfeImported={({ marketName, issuedDate, totalCents }) => {
            if (marketName) {
              setCompany(marketName);
              const match = stores.find(
                (s) =>
                  marketName.toLowerCase().includes(s.name.toLowerCase()) ||
                  s.name.toLowerCase().includes(marketName.toLowerCase()),
              );
              if (match) setStoreId(match.id);
              if (!description.trim()) setDescription(`Supermercado ${marketName}`);
            }
            if (issuedDate) setDueDate(issuedDate);
            if (totalCents) setAmountText(centsToBRInput(totalCents));
          }}
        />
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

      <div className="flex flex-wrap justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : "Salvar despesa"}
        </Button>
      </div>
    </form>
  );
}
