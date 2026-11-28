import type { PostgrestError } from "@supabase/supabase-js";
import {
  storeSchema,
  type StoreInput,
  type StoreSubtype,
  type StoreType,
} from "@/features/stores/schemas/storeSchema";
import { getSupabase } from "@/lib/supabase";

export type Store = {
  id: string;
  user_id: string;
  name: string;
  store_type: StoreType;
  store_subtype: StoreSubtype | null;
  is_default: boolean;
  created_at: string;
};

function toPortugueseStoreError(error: PostgrestError): Error {
  if (error.code === "23505") {
    return new Error("Já existe uma loja com este nome.");
  }
  return new Error("Não foi possível concluir a operação na loja. Tente novamente.");
}

export async function listStores(): Promise<Store[]> {
  const { data, error } = await getSupabase()
    .from("stores")
    .select("id, user_id, name, store_type, store_subtype, is_default, created_at")
    .order("store_type", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw toPortugueseStoreError(error);
  return (data ?? []) as Store[];
}

export async function createStore(input: StoreInput): Promise<Store> {
  const parsed = storeSchema.parse(input);
  const { data, error } = await getSupabase()
    .from("stores")
    .insert(parsed)
    .select("id, user_id, name, store_type, store_subtype, is_default, created_at")
    .single();
  if (error) throw toPortugueseStoreError(error);
  return data as Store;
}

export async function updateStore(id: string, input: StoreInput): Promise<Store> {
  const parsed = storeSchema.parse(input);
  const { data, error } = await getSupabase()
    .from("stores")
    .update(parsed)
    .eq("id", id)
    .select("id, user_id, name, store_type, store_subtype, is_default, created_at")
    .single();
  if (error) throw toPortugueseStoreError(error);
  return data as Store;
}

export async function deleteStore(id: string): Promise<void> {
  const { error } = await getSupabase().from("stores").delete().eq("id", id);
  if (error) throw toPortugueseStoreError(error);
}
