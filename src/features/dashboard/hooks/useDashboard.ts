import { useQuery } from "@tanstack/react-query";
import { getMonthlySummary } from "@/features/dashboard/api/dashboardApi";

export const DASHBOARD_QUERY_KEY = ["dashboard"] as const;

export function useMonthlySummary(month: string) {
  return useQuery({
    queryKey: [...DASHBOARD_QUERY_KEY, "monthly-summary", month],
    queryFn: () => getMonthlySummary(month),
  });
}
