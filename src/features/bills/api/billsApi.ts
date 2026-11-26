import type { PostgrestError } from "@supabase/supabase-js";
import {
  billSchema,
  todayIsoFortaleza,
  type BillInput,
  type BillStatus,
  type PaymentType,
} from "@/features/bills/schemas/billSchema";
import { monthRange } from "@/lib/dates";
import { getSupabase } from "@/lib/supabase";

export type Bill = {
  id: string;
  user_id: string;
  description: string;
  company: string | null;
  category_id: string;
  amount_cents: number;
  payment_type: PaymentType;
  bank: string | null;
  agency: string | null;
  account_number: string | null;
  due_date: string;
  status: BillStatus;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BillWithCategory = Bill & {
  category_name: string;
};

export type BillStatusFilter = "all" | "pending" | "paid" | "overdue";

export type BillFilters = {
  month?: string;
  categoryId?: string;
  status?: BillStatusFilter;
};

type RawBillRow = Bill & {
  categories: { name: string } | { name: string }[] | null;
};

const BILL_SELECT =
  "id, user_id, description, company, category_id, amount_cents, payment_type, bank, agency, account_number, due_date, status, paid_at, created_at, updated_at, categories(name)";

function mapBillRow(row: RawBillRow): BillWithCategory {
  const category = Array.isArray(row.categories) ? row.categories[0] : row.categories;
  const { categories: _unused, ...bill } = row;
  void _unused;
  return {
    ...bill,
    category_name: category?.name ?? "Sem categoria",
  };
}

function toPortugueseBillError(error: PostgrestError): Error {
  if (error.code === "23514") {
    return new Error("Dados inválidos para a conta. Verifique os campos obrigatórios.");
  }
  if (error.code === "23503") {
    return new Error("Categoria inválida. Escolha uma categoria existente.");
  }
  return new Error("Não foi possível concluir a operação na conta. Tente novamente.");
}

export async function listBills(filters: BillFilters = {}): Promise<BillWithCategory[]> {
  let query = getSupabase()
    .from("bills")
    .select(BILL_SELECT)
    .order("due_date", { ascending: true })
    .order("created_at", { ascending: false });

  if (filters.month) {
    const { from, to } = monthRange(filters.month);
    query = query.gte("due_date", from).lte("due_date", to);
  }

  if (filters.categoryId) {
    query = query.eq("category_id", filters.categoryId);
  }

  if (filters.status === "pending") {
    query = query.eq("status", "pending");
  } else if (filters.status === "paid") {
    query = query.eq("status", "paid");
  } else if (filters.status === "overdue") {
    query = query.eq("status", "pending").lt("due_date", todayIsoFortaleza());
  }

  const { data, error } = await query;
  if (error) throw toPortugueseBillError(error);
  return ((data ?? []) as unknown as RawBillRow[]).map(mapBillRow);
}

export async function createBill(input: BillInput): Promise<Bill> {
  const parsed = billSchema.parse(input);
  const payload = {
    ...parsed,
    paid_at: parsed.status === "paid" ? (parsed.paid_at ?? todayIsoFortaleza()) : null,
  };

  const { data, error } = await getSupabase().from("bills").insert(payload).select("*").single();
  if (error) throw toPortugueseBillError(error);
  return data as Bill;
}

export async function updateBill(id: string, input: BillInput): Promise<Bill> {
  const parsed = billSchema.parse(input);
  const payload = {
    ...parsed,
    paid_at: parsed.status === "paid" ? (parsed.paid_at ?? todayIsoFortaleza()) : null,
  };

  const { data, error } = await getSupabase()
    .from("bills")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw toPortugueseBillError(error);
  return data as Bill;
}

export async function deleteBill(id: string): Promise<void> {
  const { error } = await getSupabase().from("bills").delete().eq("id", id);
  if (error) throw toPortugueseBillError(error);
}

export async function markBillAsPaid(
  id: string,
  paidAt: string = todayIsoFortaleza(),
): Promise<Bill> {
  const { data, error } = await getSupabase()
    .from("bills")
    .update({ status: "paid", paid_at: paidAt })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw toPortugueseBillError(error);
  return data as Bill;
}
