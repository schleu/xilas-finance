import type { PostgrestError } from "@supabase/supabase-js";
import {
  incomeSchema,
  incomeTypeSchema,
  type IncomeInput,
  type IncomeNature,
} from "@/features/incomes/schemas/incomeSchema";
import { monthRange } from "@/lib/dates";
import { getSupabase } from "@/lib/supabase";

export type IncomeType = {
  id: string;
  user_id: string;
  name: string;
  is_default: boolean;
  created_at: string;
};

export type Income = {
  id: string;
  user_id: string;
  description: string;
  amount_cents: number;
  received_date: string;
  nature: IncomeNature;
  income_type_id: string;
  bank_id: string | null;
  created_at: string;
  updated_at: string;
};

export type IncomeWithRelations = Income & {
  income_type_name: string;
  bank_name: string | null;
};

export type IncomeFilters = {
  month?: string;
  nature?: IncomeNature | "all";
  incomeTypeId?: string;
};

type RawIncomeRow = Income & {
  income_types: { name: string } | { name: string }[] | null;
  banks: { name: string } | { name: string }[] | null;
};

const INCOME_SELECT =
  "id, user_id, description, amount_cents, received_date, nature, income_type_id, bank_id, created_at, updated_at, income_types(name), banks(name)";

function toPortugueseIncomeError(error: PostgrestError): Error {
  if (error.code === "23505") {
    return new Error("Já existe um tipo de renda com este nome.");
  }
  if (error.code === "23503") {
    return new Error("Tipo de renda em uso ou inválido.");
  }
  return new Error("Não foi possível concluir a operação na renda. Tente novamente.");
}

export async function listIncomeTypes(): Promise<IncomeType[]> {
  const { data, error } = await getSupabase()
    .from("income_types")
    .select("id, user_id, name, is_default, created_at")
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });
  if (error) throw toPortugueseIncomeError(error);
  return (data ?? []) as IncomeType[];
}

export async function createIncomeType(name: string): Promise<IncomeType> {
  const parsed = incomeTypeSchema.parse({ name });
  const { data, error } = await getSupabase()
    .from("income_types")
    .insert({ name: parsed.name })
    .select("id, user_id, name, is_default, created_at")
    .single();
  if (error) throw toPortugueseIncomeError(error);
  return data as IncomeType;
}

export async function deleteIncomeType(id: string): Promise<void> {
  const { error } = await getSupabase().from("income_types").delete().eq("id", id);
  if (error) throw toPortugueseIncomeError(error);
}

export async function listIncomes(filters: IncomeFilters = {}): Promise<IncomeWithRelations[]> {
  let query = getSupabase()
    .from("incomes")
    .select(INCOME_SELECT)
    .order("received_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.month) {
    const { from, to } = monthRange(filters.month);
    query = query.gte("received_date", from).lte("received_date", to);
  }
  if (filters.nature && filters.nature !== "all") {
    query = query.eq("nature", filters.nature);
  }
  if (filters.incomeTypeId) {
    query = query.eq("income_type_id", filters.incomeTypeId);
  }

  const { data, error } = await query;
  if (error) throw toPortugueseIncomeError(error);

  return ((data ?? []) as unknown as RawIncomeRow[]).map((row) => {
    const typeObj = Array.isArray(row.income_types) ? row.income_types[0] : row.income_types;
    const bankObj = Array.isArray(row.banks) ? row.banks[0] : row.banks;
    const { income_types: _t, banks: _b, ...income } = row;
    void _t;
    void _b;
    return {
      ...income,
      income_type_name: typeObj?.name ?? "Outros",
      bank_name: bankObj?.name ?? null,
    };
  });
}

export async function createIncome(input: IncomeInput): Promise<Income> {
  const parsed = incomeSchema.parse(input);
  const { data, error } = await getSupabase()
    .from("incomes")
    .insert({ ...parsed, bank_id: parsed.bank_id ?? null })
    .select("*")
    .single();
  if (error) throw toPortugueseIncomeError(error);
  return data as Income;
}

export async function updateIncome(id: string, input: IncomeInput): Promise<Income> {
  const parsed = incomeSchema.parse(input);
  const { data, error } = await getSupabase()
    .from("incomes")
    .update({ ...parsed, bank_id: parsed.bank_id ?? null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw toPortugueseIncomeError(error);
  return data as Income;
}

export async function deleteIncome(id: string): Promise<void> {
  const { error } = await getSupabase().from("incomes").delete().eq("id", id);
  if (error) throw toPortugueseIncomeError(error);
}

export async function getMonthlyIncomeSummary(month: string): Promise<{
  month: string;
  total_income_cents: number;
}> {
  const { data, error } = await getSupabase().rpc("monthly_income_summary", {
    p_month: `${month}-01`,
  });
  if (error) throw toPortugueseIncomeError(error);
  const row = (Array.isArray(data) ? data[0] : data) as
    | { month: string; total_income_cents: number | string }
    | undefined;
  return {
    month: row?.month ?? `${month}-01`,
    total_income_cents: Number(row?.total_income_cents ?? 0),
  };
}
