import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createBank, deleteBank, listBanks, updateBank } from "@/features/banks/api/banksApi";
import type { BankInput } from "@/features/banks/schemas/bankSchema";

export const BANKS_QUERY_KEY = ["banks"] as const;

export function useBanks() {
  return useQuery({
    queryKey: BANKS_QUERY_KEY,
    queryFn: listBanks,
  });
}

export function useCreateBank() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BankInput) => createBank(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: BANKS_QUERY_KEY });
    },
  });
}

export function useUpdateBank() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: BankInput }) => updateBank(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: BANKS_QUERY_KEY });
    },
  });
}

export function useDeleteBank() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteBank(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: BANKS_QUERY_KEY });
    },
  });
}
