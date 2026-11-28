import {
  billItemSchema,
  type BillItemCategory,
  type BillItemInput,
  type BillItemUnit,
} from "@/features/bills/schemas/billItemSchema";
import { getSupabase } from "@/lib/supabase";

export type BillItemRecord = {
  id: string;
  bill_id: string;
  user_id: string;
  description: string;
  item_category: BillItemCategory;
  quantity: number;
  unit: BillItemUnit;
  unit_price_cents: number;
  total_cents: number;
  created_at: string;
};

export async function listBillItems(billId: string): Promise<BillItemRecord[]> {
  const { data, error } = await getSupabase()
    .from("bill_items")
    .select("id, bill_id, user_id, description, item_category, quantity, unit, unit_price_cents, total_cents, created_at")
    .eq("bill_id", billId)
    .order("created_at", { ascending: true });
  if (error) throw new Error("Não foi possível carregar os subitens da compra.");
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    ...(row as BillItemRecord),
    quantity: Number(row.quantity),
    unit_price_cents: Number(row.unit_price_cents),
    total_cents: Number(row.total_cents),
  }));
}

export async function replaceBillItems(billId: string, items: BillItemInput[]): Promise<void> {
  const validated = items.map((item) => billItemSchema.parse(item));
  const { error: delError } = await getSupabase()
    .from("bill_items")
    .delete()
    .eq("bill_id", billId);
  if (delError) throw new Error("Não foi possível atualizar os subitens.");

  if (validated.length === 0) return;

  const { error: insError } = await getSupabase()
    .from("bill_items")
    .insert(validated.map((item) => ({ ...item, bill_id: billId })));
  if (insError) throw new Error("Não foi possível salvar os subitens.");
}
