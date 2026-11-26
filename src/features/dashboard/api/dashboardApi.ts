import { monthRange } from "@/lib/dates";
import { getSupabase } from "@/lib/supabase";

export interface MonthlySummary {
  month: string;
  paid_total_cents: number;
  pending_total_cents: number;
  overdue_count: number;
}

interface MonthlySummaryRow {
  month: string;
  paid_total_cents: number | string;
  pending_total_cents: number | string;
  overdue_count: number | string;
}

export async function getMonthlySummary(month: string): Promise<MonthlySummary> {
  const { from } = monthRange(month);
  const { data, error } = await getSupabase().rpc("monthly_summary", {
    p_month: from,
  });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as MonthlySummaryRow[];
  const row = rows[0];

  if (!row) {
    return {
      month: from,
      paid_total_cents: 0,
      pending_total_cents: 0,
      overdue_count: 0,
    };
  }

  return {
    month: row.month,
    paid_total_cents: Number(row.paid_total_cents),
    pending_total_cents: Number(row.pending_total_cents),
    overdue_count: Number(row.overdue_count),
  };
}

export interface CategorySpending {
  category_id: string;
  category_name: string;
  paid_total_cents: number;
  bills_count: number;
}

interface CategorySpendingRow {
  category_id: string;
  category_name: string;
  paid_total_cents: number | string;
  bills_count: number | string;
}

export async function getSpendingByCategory(
  from: string,
  to: string,
): Promise<CategorySpending[]> {
  const { data, error } = await getSupabase().rpc("spending_by_category", {
    p_from: from,
    p_to: to,
  });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as CategorySpendingRow[];
  return rows.map((row) => ({
    category_id: row.category_id,
    category_name: row.category_name,
    paid_total_cents: Number(row.paid_total_cents),
    bills_count: Number(row.bills_count),
  }));
}

export interface MonthlyEvolutionPoint {
  month: string;
  paid_total_cents: number;
}

interface MonthlyEvolutionRow {
  month: string;
  paid_total_cents: number | string;
}

export async function getMonthlyEvolution(
  months = 6,
  endMonth?: string,
): Promise<MonthlyEvolutionPoint[]> {
  const params: { p_months: number; p_end_month?: string } = { p_months: months };
  if (endMonth) {
    params.p_end_month = monthRange(endMonth).from;
  }

  const { data, error } = await getSupabase().rpc("monthly_evolution", params);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as MonthlyEvolutionRow[];
  return rows.map((row) => ({
    month: row.month,
    paid_total_cents: Number(row.paid_total_cents),
  }));
}
