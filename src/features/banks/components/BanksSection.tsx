import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
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

  const [showFormModal, setShowFormModal] = useState(false);
  const [name, setName] = useState("");
  const [hasDebitAccount, setHasDebitAccount] = useState(false);
  const [agency, setAgency] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [hasCreditCard, setHasCreditCard] = useState(false);
  const [creditCardLabel, setCreditCardLabel] = useState("");
  const [creditCardDueDay, setCreditCardDueDay] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingBank, setDeletingBank] = useState<Bank | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
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
    setFormError(null);
    setShowFormModal(false);
  };

  const openCreateModal = () => {
    setName("");
    setHasDebitAccount(false);
    setAgency("");
    setAccountNumber("");
    setHasCreditCard(false);
    setCreditCardLabel("");
    setCreditCardDueDay("");
    setEditingId(null);
    setFormError(null);
    setShowFormModal(true);
  };

  const startEdit = (bank: Bank) => {
    setFormError(null);
    setEditingId(bank.id);
    setName(bank.name);
    setHasDebitAccount(bank.has_debit_account);
    setAgency(bank.agency ?? "");
    setAccountNumber(bank.account_number ?? "");
    setHasCreditCard(bank.has_credit_card);
    setCreditCardLabel(bank.credit_card_label ?? "");
    setCreditCardDueDay(bank.credit_card_due_day ? String(bank.credit_card_due_day) : "");
    setShowFormModal(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

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
      setFormError(parsed.error.issues[0]?.message ?? "Verifique os dados do banco.");
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
      setFormError(error instanceof Error ? error.message : "Não foi possível salvar o banco.");
    }
  };

  const handleDelete = async (id: string) => {
    setActionError(null);
    try {
      await deleteMutation.mutateAsync(id);
      setDeletingBank(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Não foi possível excluir o banco.");
    }
  };

  return (
    <div className="space-y-4">
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
          Não foi possível carregar seus bancos.
        </p>
      )}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Bancos</CardTitle>
            <CardDescription>
              Gerencie suas contas bancárias (débito em conta) e cartões de crédito.
            </CardDescription>
          </div>
          <Button type="button" size="sm" onClick={openCreateModal}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Novo banco
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p role="status" className="text-sm text-muted-foreground">
              Carregando bancos...
            </p>
          ) : banks.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum banco cadastrado.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Banco</TableHead>
                  <TableHead>Débito em conta</TableHead>
                  <TableHead>Cartão de crédito</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {banks.map((bank) => (
                  <TableRow key={bank.id}>
                    <TableCell className="font-medium">{bank.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {bank.has_debit_account
                        ? `Ag. ${maskBankCode(bank.agency)} · Conta ${maskBankCode(bank.account_number)}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {bank.has_credit_card
                        ? `${bank.credit_card_label ? `${bank.credit_card_label} · ` : ""}Vence dia ${bank.credit_card_due_day}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center justify-end gap-1">
                        <IconTooltipButton
                          label="Editar"
                          icon={<Pencil className="h-4 w-4" aria-hidden="true" />}
                          onClick={() => startEdit(bank)}
                        />
                        <IconTooltipButton
                          label="Excluir"
                          icon={<Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />}
                          onClick={() => setDeletingBank(bank)}
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

      {/* Modal: Novo / Editar banco */}
      <Dialog
        open={showFormModal}
        onOpenChange={(open) => {
          if (!open) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar banco" : "Novo banco"}</DialogTitle>
            <DialogDescription>
              Cadastre débito em conta (agência e conta) e/ou cartão de crédito (dia de vencimento).
            </DialogDescription>
          </DialogHeader>

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

            {formError && (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingId ? "Salvar banco" : "Adicionar banco"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Confirmar exclusão */}
      <Dialog
        open={Boolean(deletingBank)}
        onOpenChange={(open) => {
          if (!open) setDeletingBank(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir banco</DialogTitle>
            <DialogDescription>
              Excluir o banco <strong>{deletingBank?.name}</strong>? Despesas e rendas históricas
              serão mantidas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeletingBank(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deletingBank && void handleDelete(deletingBank.id)}
            >
              Confirmar exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
