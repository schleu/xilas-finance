import type { PostgrestError } from "@supabase/supabase-js";
import {
  billSchema,
  todayIsoFortaleza,
  type BillFormInput,
  type BillStatus,
  type PaymentType,
} from "@/features/bills/schemas/billSchema";
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
  reference_month?: string;
  status: BillStatus;
  paid_at: string | null;
  recurring_rule_id?: string | null;
  store_id?: string | null;
  bank_id?: string | null;
  supermarket_payment_method?: string | null;
  nfe_url?: string | null;
  created_at: string;
  updated_at: string;
};

export type RecurringEditScope = "single" | "future";

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
  "id, user_id, description, company, category_id, amount_cents, payment_type, bank, agency, account_number, due_date, reference_month, status, paid_at, recurring_rule_id, store_id, bank_id, supermarket_payment_method, nfe_url, created_at, updated_at, categories(name)";

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
    query = query.eq("reference_month", `${filters.month}-01`);
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

export async function createBill(
  input: BillFormInput,
  options?: { recurring?: boolean },
): Promise<Bill> {
  const parsed = billSchema.parse(input);
  const payload = {
    ...parsed,
    paid_at: parsed.status === "paid" ? (parsed.paid_at ?? todayIsoFortaleza()) : null,
  };

  if (!options?.recurring) {
    const { data, error } = await getSupabase().from("bills").insert(payload).select("*").single();
    if (error) throw toPortugueseBillError(error);
    return data as Bill;
  }

  const dueDay = Number(parsed.due_date.slice(8, 10));
  const startMonth = `${parsed.due_date.slice(0, 7)}-01`;

  const { data: rule, error: ruleError } = await getSupabase()
    .from("recurring_rules")
    .insert({
      description: parsed.description,
      company: parsed.company,
      category_id: parsed.category_id,
      amount_cents: parsed.amount_cents,
      payment_type: parsed.payment_type,
      bank: parsed.bank,
      agency: parsed.agency,
      account_number: parsed.account_number,
      due_day: dueDay,
      start_month: startMonth,
      active: true,
    })
    .select("id")
    .single();

  if (ruleError || !rule) {
    throw ruleError
      ? toPortugueseBillError(ruleError)
      : new Error("Não foi possível criar a recorrência.");
  }

  const ruleId = (rule as { id: string }).id;

  const { data: bill, error: billError } = await getSupabase()
    .from("bills")
    .insert({ ...payload, recurring_rule_id: ruleId })
    .select("*")
    .single();

  if (billError) throw toPortugueseBillError(billError);

  const { error: genError } = await getSupabase().rpc("generate_recurring_bills", {
    p_reference_date: parsed.due_date,
    p_rule_id: ruleId,
  });
  if (genError) throw toPortugueseBillError(genError);

  return bill as Bill;
}

export async function updateBill(
  id: string,
  input: BillFormInput,
  options?: {
    scope?: RecurringEditScope;
    recurringRuleId?: string | null;
    originalDueDate?: string;
  },
): Promise<Bill> {
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

  if (options?.scope === "future" && options.recurringRuleId) {
    const dueDay = Number(parsed.due_date.slice(8, 10));
    const sharedFields = {
      description: parsed.description,
      company: parsed.company,
      category_id: parsed.category_id,
      amount_cents: parsed.amount_cents,
      payment_type: parsed.payment_type,
      bank: parsed.bank,
      agency: parsed.agency,
      account_number: parsed.account_number,
    };

    const { error: ruleError } = await getSupabase()
      .from("recurring_rules")
      .update({ ...sharedFields, due_day: dueDay })
      .eq("id", options.recurringRuleId);
    if (ruleError) throw toPortugueseBillError(ruleError);

    const anchorDate = options.originalDueDate ?? parsed.due_date;
    const { error: futureError } = await getSupabase()
      .from("bills")
      .update(sharedFields)
      .eq("recurring_rule_id", options.recurringRuleId)
      .eq("status", "pending")
      .gt("due_date", anchorDate)
      .neq("id", id);
    if (futureError) throw toPortugueseBillError(futureError);
  }

  return data as Bill;
}

export async function stopRecurringRule(
  recurringRuleId: string,
  fromDate: string = todayIsoFortaleza(),
): Promise<void> {
  const { error: ruleError } = await getSupabase()
    .from("recurring_rules")
    .update({ active: false })
    .eq("id", recurringRuleId);
  if (ruleError) throw toPortugueseBillError(ruleError);

  const { error: deleteError } = await getSupabase()
    .from("bills")
    .delete()
    .eq("recurring_rule_id", recurringRuleId)
    .eq("status", "pending")
    .gte("due_date", fromDate);
  if (deleteError) throw toPortugueseBillError(deleteError);
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
