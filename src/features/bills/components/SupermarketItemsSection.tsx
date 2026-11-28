import { Camera, Download, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { QrCodeScannerModal } from "@/features/bills/components/QrCodeScannerModal";
import {
  BILL_ITEM_CATEGORIES,
  BILL_ITEM_CATEGORY_LABELS,
  BILL_ITEM_UNITS,
  SUPERMARKET_PAYMENT_LABELS,
  SUPERMARKET_PAYMENT_METHODS,
  type BillItemCategory,
  type BillItemInput,
  type BillItemUnit,
  type SupermarketPaymentMethod,
} from "@/features/bills/schemas/billItemSchema";
import { formatBRL, parseBRLToCents } from "@/lib/money";

export interface DraftSubItem {
  localId: string;
  description: string;
  item_category: BillItemCategory;
  quantityText: string;
  unit: BillItemUnit;
  unitPriceText: string;
  totalText: string;
}

interface Props {
  supermarketPayment: SupermarketPaymentMethod;
  onSupermarketPaymentChange: (value: SupermarketPaymentMethod) => void;
  nfeUrl: string;
  onNfeUrlChange: (value: string) => void;
  items: DraftSubItem[];
  onItemsChange: (items: DraftSubItem[]) => void;
  billAmountCents: number | null;
  onApplySumToBillTotal: (sumCents: number) => void;
  onNfeImported: (data: {
    marketName: string | null;
    issuedDate: string | null;
    totalCents: number | null;
  }) => void;
}

let itemCounter = 0;
function nextItemId(): string {
  itemCounter += 1;
  return `sub-${itemCounter}`;
}

function centsToBrText(cents: number): string {
  const intPart = Math.trunc(cents / 100);
  const decPart = String(Math.abs(cents % 100)).padStart(2, "0");
  return `${intPart},${decPart}`;
}

export function draftSubItemsToInputs(items: DraftSubItem[]): BillItemInput[] {
  const result: BillItemInput[] = [];
  for (const item of items) {
    const desc = item.description.trim();
    const qty = Number(item.quantityText.replace(",", "."));
    const unitCents = parseBRLToCents(item.unitPriceText);
    const totalCents = parseBRLToCents(item.totalText);
    if (!desc || !Number.isFinite(qty) || qty <= 0 || !unitCents || !totalCents) continue;
    result.push({
      description: desc,
      item_category: item.item_category,
      quantity: qty,
      unit: item.unit,
      unit_price_cents: unitCents,
      total_cents: totalCents,
    });
  }
  return result;
}

export function SupermarketItemsSection({
  supermarketPayment,
  onSupermarketPaymentChange,
  nfeUrl,
  onNfeUrlChange,
  items,
  onItemsChange,
  billAmountCents,
  onApplySumToBillTotal,
  onNfeImported,
}: Props) {
  const { session } = useAuth();
  const [showQrModal, setShowQrModal] = useState(false);
  const [isImportingNfe, setIsImportingNfe] = useState(false);
  const [nfeError, setNfeError] = useState<string | null>(null);

  const subItemsSumCents = items.reduce((sum, item) => sum + (parseBRLToCents(item.totalText) ?? 0), 0);

  const handleImportNfe = async (urlToParse?: string) => {
    const targetUrl = (urlToParse ?? nfeUrl).trim();
    if (!targetUrl) return;
    setNfeError(null);
    setIsImportingNfe(true);
    try {
      const response = await fetch("/api/nfe/parse", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ url: targetUrl }),
      });
      const data = (await response.json()) as {
        error?: string;
        marketName?: string | null;
        issuedDate?: string | null;
        totalCents?: number | null;
        items?: BillItemInput[];
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Não foi possível importar a NF-e.");
      }

      onNfeImported({
        marketName: data.marketName ?? null,
        issuedDate: data.issuedDate ?? null,
        totalCents: data.totalCents ?? null,
      });

      if (Array.isArray(data.items) && data.items.length > 0) {
        onItemsChange(
          data.items.map((item) => ({
            localId: nextItemId(),
            description: item.description,
            item_category: item.item_category,
            quantityText: String(item.quantity).replace(".", ","),
            unit: item.unit,
            unitPriceText: centsToBrText(item.unit_price_cents),
            totalText: centsToBrText(item.total_cents),
          })),
        );
      }
    } catch (err) {
      setNfeError(err instanceof Error ? err.message : "Erro ao importar NF-e.");
    } finally {
      setIsImportingNfe(false);
    }
  };

  const addEmptyItem = () => {
    onItemsChange([
      ...items,
      {
        localId: nextItemId(),
        description: "",
        item_category: "food",
        quantityText: "1",
        unit: "un",
        unitPriceText: "",
        totalText: "",
      },
    ]);
  };

  const updateItem = (localId: string, patch: Partial<DraftSubItem>) => {
    onItemsChange(
      items.map((item) => {
        if (item.localId !== localId) return item;
        const next = { ...item, ...patch };
        if (patch.quantityText !== undefined || patch.unitPriceText !== undefined) {
          const qty = Number(next.quantityText.replace(",", "."));
          const unitCents = parseBRLToCents(next.unitPriceText);
          if (Number.isFinite(qty) && qty > 0 && unitCents) {
            next.totalText = centsToBrText(Math.max(1, Math.round(qty * unitCents)));
          }
        }
        return next;
      }),
    );
  };

  return (
    <div className="space-y-4 rounded-md border bg-muted/20 p-4">
      <h3 className="text-sm font-semibold">Detalhes de Supermercado</h3>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="supermarket-payment">Forma de pagamento (Supermercado)</Label>
          <select
            id="supermarket-payment"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={supermarketPayment}
            onChange={(e) => onSupermarketPaymentChange(e.target.value as SupermarketPaymentMethod)}
          >
            {SUPERMARKET_PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {SUPERMARKET_PAYMENT_LABELS[m]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="supermarket-nfe-url">Link da NF-e / NFC-e (opcional — CE e BA)</Label>
          <div className="flex gap-1.5">
            <Input
              id="supermarket-nfe-url"
              value={nfeUrl}
              onChange={(e) => onNfeUrlChange(e.target.value)}
              placeholder="https://nfce.sefaz.ce.gov.br/..."
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Ler QR Code"
              onClick={() => setShowQrModal(true)}
            >
              <Camera className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!nfeUrl.trim() || isImportingNfe}
              onClick={() => void handleImportNfe()}
            >
              <Download className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              {isImportingNfe ? "..." : "Importar"}
            </Button>
          </div>
        </div>
      </div>

      {nfeError && (
        <p role="alert" className="text-xs text-destructive">
          {nfeError}
        </p>
      )}

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            Subitens da compra (opcional) — Soma: {formatBRL(subItemsSumCents)}
          </span>
          <div className="flex gap-2">
            {items.length > 0 && billAmountCents !== subItemsSumCents && subItemsSumCents > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onApplySumToBillTotal(subItemsSumCents)}
              >
                Usar soma como total
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" onClick={addEmptyItem}>
              <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Adicionar subitem
            </Button>
          </div>
        </div>

        {items.map((item) => (
          <div key={item.localId} className="grid gap-2 rounded-md border bg-background p-2.5 sm:grid-cols-6">
            <Input
              className="sm:col-span-2"
              aria-label="Descrição do subitem"
              placeholder="Descrição (ex.: Sabão em pó)"
              value={item.description}
              onChange={(e) => updateItem(item.localId, { description: e.target.value })}
            />
            <select
              aria-label="Categoria do subitem"
              className="h-9 rounded-md border border-input bg-background px-2 text-xs"
              value={item.item_category}
              onChange={(e) =>
                updateItem(item.localId, { item_category: e.target.value as BillItemCategory })
              }
            >
              {BILL_ITEM_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {BILL_ITEM_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
            <div className="flex gap-1">
              <Input
                aria-label="Quantidade"
                placeholder="Qtd"
                value={item.quantityText}
                onChange={(e) => updateItem(item.localId, { quantityText: e.target.value })}
              />
              <select
                aria-label="Unidade"
                className="h-9 rounded-md border border-input bg-background px-1.5 text-xs"
                value={item.unit}
                onChange={(e) => updateItem(item.localId, { unit: e.target.value as BillItemUnit })}
              >
                {BILL_ITEM_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <Input
              aria-label="Valor unitário"
              placeholder="Unit. (R$)"
              value={item.unitPriceText}
              onChange={(e) => updateItem(item.localId, { unitPriceText: e.target.value })}
            />
            <div className="flex gap-1">
              <Input
                aria-label="Valor total do subitem"
                placeholder="Total (R$)"
                value={item.totalText}
                onChange={(e) => updateItem(item.localId, { totalText: e.target.value })}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Remover subitem"
                onClick={() => onItemsChange(items.filter((i) => i.localId !== item.localId))}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {showQrModal && (
        <QrCodeScannerModal
          onDetected={(detectedUrl) => {
            onNfeUrlChange(detectedUrl);
            setShowQrModal(false);
            void handleImportNfe(detectedUrl);
          }}
          onClose={() => setShowQrModal(false)}
        />
      )}
    </div>
  );
}
