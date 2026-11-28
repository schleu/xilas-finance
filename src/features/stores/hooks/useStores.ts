import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createStore, deleteStore, listStores, updateStore } from "@/features/stores/api/storesApi";
import type { StoreInput } from "@/features/stores/schemas/storeSchema";

export const STORES_QUERY_KEY = ["stores"] as const;

export function useStores() {
  return useQuery({
    queryKey: STORES_QUERY_KEY,
    queryFn: listStores,
  });
}

export function useCreateStore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: StoreInput) => createStore(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: STORES_QUERY_KEY });
    },
  });
}

export function useUpdateStore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: StoreInput }) => updateStore(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: STORES_QUERY_KEY });
    },
  });
}

export function useDeleteStore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteStore(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: STORES_QUERY_KEY });
    },
  });
}
