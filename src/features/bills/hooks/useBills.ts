import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createBill,
  deleteBill,
  listBills,
  markBillAsPaid,
  stopRecurringRule,
  updateBill,
  type BillFilters,
  type RecurringEditScope,
} from "@/features/bills/api/billsApi";
import type { BillFormInput } from "@/features/bills/schemas/billSchema";
import { DASHBOARD_QUERY_KEY } from "@/features/dashboard/hooks/useDashboard";

export const BILLS_QUERY_KEY = ["bills"] as const;

function invalidateBillQueries(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: BILLS_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
}

export function useBills(filters: BillFilters = {}) {
  return useQuery({
    queryKey: [...BILLS_QUERY_KEY, filters],
    queryFn: () => listBills(filters),
  });
}

export function useCreateBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (arg: BillFormInput | { input: BillFormInput; recurring?: boolean }) => {
      if ("input" in arg) {
        return createBill(arg.input, { recurring: arg.recurring });
      }
      return createBill(arg);
    },
    onSuccess: () => {
      invalidateBillQueries(queryClient);
    },
  });
}

export function useUpdateBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
      scope,
      recurringRuleId,
      originalDueDate,
    }: {
      id: string;
      input: BillFormInput;
      scope?: RecurringEditScope;
      recurringRuleId?: string | null;
      originalDueDate?: string;
    }) => updateBill(id, input, { scope, recurringRuleId, originalDueDate }),
    onSuccess: () => {
      invalidateBillQueries(queryClient);
    },
  });
}

export function useStopRecurringRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (recurringRuleId: string) => stopRecurringRule(recurringRuleId),
    onSuccess: () => {
      invalidateBillQueries(queryClient);
    },
  });
}

export function useDeleteBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteBill(id),
    onSuccess: () => {
      invalidateBillQueries(queryClient);
    },
  });
}

export function useMarkBillAsPaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, paidAt }: { id: string; paidAt?: string }) => markBillAsPaid(id, paidAt),
    onSuccess: () => {
      invalidateBillQueries(queryClient);
    },
  });
}
