import { useQuery } from "@tanstack/react-query";
import {
  getMonthlyEvolution,
  getMonthlySummary,
  getSpendingByCategory,
} from "@/features/dashboard/api/dashboardApi";
import { monthRange } from "@/lib/dates";

export const DASHBOARD_QUERY_KEY = ["dashboard"] as const;

export function useMonthlySummary(month: string) {
  return useQuery({
    queryKey: [...DASHBOARD_QUERY_KEY, "monthly-summary", month],
    queryFn: () => getMonthlySummary(month),
  });
}

export function useSpendingByCategory(month: string) {
  const { from, to } = monthRange(month);
  return useQuery({
    queryKey: [...DASHBOARD_QUERY_KEY, "spending-by-category", from, to],
    queryFn: () => getSpendingByCategory(from, to),
  });
}

export function useMonthlyEvolution(endMonth: string, months = 6) {
  return useQuery({
    queryKey: [...DASHBOARD_QUERY_KEY, "monthly-evolution", endMonth, months],
    queryFn: () => getMonthlyEvolution(months, endMonth),
  });
}
