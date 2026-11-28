import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DASHBOARD_QUERY_KEY } from "@/features/dashboard/hooks/useDashboard";
import {
  createIncome,
  createIncomeType,
  deleteIncome,
  deleteIncomeType,
  getMonthlyIncomeSummary,
  listIncomes,
  listIncomeTypes,
  updateIncome,
  type IncomeFilters,
} from "@/features/incomes/api/incomesApi";
import type { IncomeInput } from "@/features/incomes/schemas/incomeSchema";

export const INCOMES_QUERY_KEY = ["incomes"] as const;
export const INCOME_TYPES_QUERY_KEY = ["income_types"] as const;

function invalidateIncomeQueries(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: INCOMES_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
}

export function useIncomeTypes() {
  return useQuery({
    queryKey: INCOME_TYPES_QUERY_KEY,
    queryFn: listIncomeTypes,
  });
}

export function useCreateIncomeType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createIncomeType(name),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: INCOME_TYPES_QUERY_KEY });
    },
  });
}

export function useDeleteIncomeType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteIncomeType(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: INCOME_TYPES_QUERY_KEY });
    },
  });
}

export function useIncomes(filters: IncomeFilters = {}) {
  return useQuery({
    queryKey: [...INCOMES_QUERY_KEY, filters],
    queryFn: () => listIncomes(filters),
  });
}

export function useMonthlyIncomeSummary(month: string) {
  return useQuery({
    queryKey: [...DASHBOARD_QUERY_KEY, "income-summary", month],
    queryFn: () => getMonthlyIncomeSummary(month),
  });
}

export function useCreateIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: IncomeInput) => createIncome(input),
    onSuccess: () => {
      invalidateIncomeQueries(queryClient);
    },
  });
}

export function useUpdateIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: IncomeInput }) => updateIncome(id, input),
    onSuccess: () => {
      invalidateIncomeQueries(queryClient);
    },
  });
}

export function useDeleteIncome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteIncome(id),
    onSuccess: () => {
      invalidateIncomeQueries(queryClient);
    },
  });
}
