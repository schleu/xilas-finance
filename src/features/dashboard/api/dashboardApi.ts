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
