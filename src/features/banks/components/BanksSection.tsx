import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Bank } from "@/features/banks/api/banksApi";
import {
  useBanks,
  useCreateBank,
  useDeleteBank,
  useUpdateBank,
} from "@/features/banks/hooks/useBanks";
import { bankSchema } from "@/features/banks/schemas/bankSchema";
import { maskBankCode } from "@/features/bills/schemas/billSchema";

export function BanksSection() {
  const { data: banks = [], isLoading, error: loadError } = useBanks();
  const createMutation = useCreateBank();
  const updateMutation = useUpdateBank();
  const deleteMutation = useDeleteBank();

  const [name, setName] = useState("");
  const [hasDebitAccount, setHasDebitAccount] = useState(false);
  const [agency, setAgency] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [hasCreditCard, setHasCreditCard] = useState(false);
  const [creditCardLabel, setCreditCardLabel] = useState("");
  const [creditCardDueDay, setCreditCardDueDay] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const resetForm = () => {
    setName("");
    setHasDebitAccount(false);
    setAgency("");
    setAccountNumber("");
    setHasCreditCard(false);
    setCreditCardLabel("");
    setCreditCardDueDay("");
    setEditingId(null);
    setActionError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setActionError(null);

    const parsedDueDay = creditCardDueDay.trim() ? Number(creditCardDueDay) : null;
    const parsed = bankSchema.safeParse({
      name,
      has_debit_account: hasDebitAccount,
      agency: hasDebitAccount ? agency : null,
      account_number: hasDebitAccount ? accountNumber : null,
      has_credit_card: hasCreditCard,
      credit_card_label: hasCreditCard ? creditCardLabel : null,
      credit_card_due_day: hasCreditCard ? parsedDueDay : null,
    });

    if (!parsed.success) {
      setActionError(parsed.error.issues[0]?.message ?? "Verifique os dados do banco.");
      return;
    }

    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, input: parsed.data });
      } else {
        await createMutation.mutateAsync(parsed.data);
      }
      resetForm();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Não foi possível salvar o banco.");
    }
  };

  const startEdit = (bank: Bank) => {
    setActionError(null);
    setConfirmDeleteId(null);
    setEditingId(bank.id);
    setName(bank.name);
    setHasDebitAccount(bank.has_debit_account);
    setAgency(bank.agency ?? "");
    setAccountNumber(bank.account_number ?? "");
    setHasCreditCard(bank.has_credit_card);
    setCreditCardLabel(bank.credit_card_label ?? "");
    setCreditCardDueDay(bank.credit_card_due_day ? String(bank.credit_card_due_day) : "");
  };

  const handleDelete = async (id: string) => {
    setActionError(null);
    try {
      await deleteMutation.mutateAsync(id);
      setConfirmDeleteId(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Não foi possível excluir o banco.");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Editar banco" : "Novo banco"}</CardTitle>
          <CardDescription>
            Cadastre seus bancos com débito em conta (agência e conta) e/ou cartão de crédito (dia
            de vencimento).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="bank-name">Nome do banco *</Label>
              <Input
                id="bank-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Nubank, Banco do Brasil, Itaú"
              />
            </div>

            <div className="space-y-3 rounded-md border p-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={hasDebitAccount}
                  onChange={(e) => setHasDebitAccount(e.target.checked)}
                />
                Possui débito em conta
              </label>

              {hasDebitAccount && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="bank-agency">Agência *</Label>
                    <Input
                      id="bank-agency"
                      value={agency}
                      onChange={(e) => setAgency(e.target.value)}
                      placeholder="Ex.: 0001"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="bank-account">Conta *</Label>
                    <Input
                      id="bank-account"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      placeholder="Ex.: 123456-7"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3 rounded-md border p-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={hasCreditCard}
                  onChange={(e) => setHasCreditCard(e.target.checked)}
                />
                Possui cartão de crédito
              </label>

              {hasCreditCard && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="bank-card-due-day">Dia de vencimento (1 a 31) *</Label>
                    <Input
                      id="bank-card-due-day"
                      type="number"
                      min={1}
                      max={31}
                      value={creditCardDueDay}
                      onChange={(e) => setCreditCardDueDay(e.target.value)}
                      placeholder="Ex.: 10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="bank-card-label">Apelido do cartão (opcional)</Label>
                    <Input
                      id="bank-card-label"
                      value={creditCardLabel}
                      onChange={(e) => setCreditCardLabel(e.target.value)}
                      placeholder="Ex.: Nubank Ultravioleta"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingId ? "Salvar banco" : "Adicionar banco"}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {actionError && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {actionError}
        </p>
      )}

      {loadError && (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível carregar seus bancos.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Seus bancos</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p role="status" className="text-sm text-muted-foreground">
              Carregando bancos...
            </p>
          ) : banks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum banco cadastrado.</p>
          ) : (
            <ul className="divide-y">
              {banks.map((bank) => (
                <li key={bank.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <span className="font-medium">{bank.name}</span>
                      {bank.has_debit_account && (
                        <p className="text-xs text-muted-foreground">
                          Débito em conta · Ag. {maskBankCode(bank.agency)} · Conta{" "}
                          {maskBankCode(bank.account_number)}
                        </p>
                      )}
                      {bank.has_credit_card && (
                        <p className="text-xs text-muted-foreground">
                          Cartão de crédito
                          {bank.credit_card_label ? ` (${bank.credit_card_label})` : ""} · Vence dia{" "}
                          {bank.credit_card_due_day}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => startEdit(bank)}>
                        Editar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => setConfirmDeleteId(bank.id)}
                      >
                        Excluir
                      </Button>
                    </div>
                  </div>
                  {confirmDeleteId === bank.id && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/40 p-2.5 text-sm">
                      <span>
                        Excluir o banco <strong>{bank.name}</strong>? Despesas e rendas históricas
                        serão mantidas.
                      </span>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={deleteMutation.isPending}
                          onClick={() => void handleDelete(bank.id)}
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
    </div>
  );
}
