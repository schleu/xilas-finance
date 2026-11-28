import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { BILL_STATUS_LABELS, PAYMENT_TYPE_LABELS } from "@/features/bills/schemas/billSchema";
import type { ProposedBillDraft } from "@/features/chat/schemas/chatSchemas";
import { formatDateBR } from "@/lib/dates";
import { formatBRL } from "@/lib/money";

interface BillProposalCardProps {
  proposal: ProposedBillDraft;
  status: "pending" | "saved" | "cancelled";
  isSaving?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function BillProposalCard({
  proposal,
  status,
  isSaving = false,
  error = null,
  onConfirm,
  onCancel,
}: BillProposalCardProps) {
  return (
    <Card className="mt-2 border-primary/30 bg-background">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Confirmar cadastro de conta</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5 text-sm">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
          <dt className="text-muted-foreground">Descrição</dt>
          <dd className="font-medium">{proposal.description}</dd>

          {proposal.company && (
            <>
              <dt className="text-muted-foreground">Empresa</dt>
              <dd>{proposal.company}</dd>
            </>
          )}

          <dt className="text-muted-foreground">Categoria</dt>
          <dd>{proposal.category_name}</dd>

          <dt className="text-muted-foreground">Valor</dt>
          <dd className="font-semibold tabular-nums">{formatBRL(proposal.amount_cents)}</dd>

          <dt className="text-muted-foreground">Vencimento</dt>
          <dd>{formatDateBR(proposal.due_date)}</dd>

          <dt className="text-muted-foreground">Pagamento</dt>
          <dd>{PAYMENT_TYPE_LABELS[proposal.payment_type]}</dd>

          <dt className="text-muted-foreground">Status</dt>
          <dd>{BILL_STATUS_LABELS[proposal.status]}</dd>

          {proposal.recurring && (
            <>
              <dt className="text-muted-foreground">Recorrência</dt>
              <dd>Mensal</dd>
            </>
          )}
        </dl>

        {error && (
          <p role="alert" className="pt-1 text-xs text-destructive">
            {error}
          </p>
        )}
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2 pt-2">
        {status === "saved" ? (
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
            Conta salva com sucesso.
          </p>
        ) : status === "cancelled" ? (
          <p className="text-xs text-muted-foreground">Cadastro cancelado.</p>
        ) : (
          <>
            <Button type="button" size="sm" disabled={isSaving} onClick={onConfirm}>
              <Check className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              {isSaving ? "Salvando..." : "Confirmar e salvar"}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={isSaving} onClick={onCancel}>
              <X className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Cancelar
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}
