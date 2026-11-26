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

export const BILLS_QUERY_KEY = ["bills"] as const;

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
      void queryClient.invalidateQueries({ queryKey: BILLS_QUERY_KEY });
    },
  });
}

export function useUpdateBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: BillInput }) => updateBill(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: BILLS_QUERY_KEY });
    },
  });
}

export function useDeleteBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteBill(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: BILLS_QUERY_KEY });
    },
  });
}

export function useMarkBillAsPaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, paidAt }: { id: string; paidAt?: string }) => markBillAsPaid(id, paidAt),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: BILLS_QUERY_KEY });
    },
  });
}
