import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createBill,
  deleteBill,
  listBills,
  markBillAsPaid,
  updateBill,
  type BillFilters,
} from "@/features/bills/api/billsApi";
import type { BillInput } from "@/features/bills/schemas/billSchema";
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
    mutationFn: (input: BillInput) => createBill(input),
    onSuccess: () => {
      invalidateBillQueries(queryClient);
    },
  });
}

export function useUpdateBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: BillInput }) => updateBill(id, input),
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
