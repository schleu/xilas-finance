import type { PostgrestError } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";

export type Category = {
  id: string;
  user_id: string;
  name: string;
  is_default: boolean;
  created_at: string;
};

function toPortugueseCategoryError(error: PostgrestError): Error {
  if (error.code === "23505") {
    return new Error("Já existe uma categoria com este nome.");
  }
  if (error.code === "23503") {
    return new Error(
      "Esta categoria está em uso. Escolha outra categoria para reatribuir as contas antes de excluir.",
    );
  }
  return new Error("Não foi possível concluir a operação de categoria. Tente novamente.");
}

export async function listCategories(): Promise<Category[]> {
  const { data, error } = await getSupabase()
    .from("categories")
    .select("id, user_id, name, is_default, created_at")
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });

  if (error) throw toPortugueseCategoryError(error);
  return (data ?? []) as Category[];
}

export async function createCategory(name: string): Promise<Category> {
  const { data, error } = await getSupabase()
    .from("categories")
    .insert({ name: name.trim() })
    .select("id, user_id, name, is_default, created_at")
    .single();

  if (error) throw toPortugueseCategoryError(error);
  return data as Category;
}

export async function renameCategory(id: string, name: string): Promise<Category> {
  const { data, error } = await getSupabase()
    .from("categories")
    .update({ name: name.trim() })
    .eq("id", id)
    .select("id, user_id, name, is_default, created_at")
    .single();

  if (error) throw toPortugueseCategoryError(error);
  return data as Category;
}

export async function countBillsInCategory(categoryId: string): Promise<number> {
  const { count, error } = await getSupabase()
    .from("bills")
    .select("id", { count: "exact", head: true })
    .eq("category_id", categoryId);

  if (error) {
    // Antes da migração T-08 (`bills`), a tabela ainda não existe no banco.
    if (error.code === "42P01" || error.code === "PGRST205") {
      return 0;
    }
    throw toPortugueseCategoryError(error);
  }

  return count ?? 0;
}

export async function deleteCategory(id: string, reassignToCategoryId?: string): Promise<void> {
  const supabase = getSupabase();

  if (reassignToCategoryId) {
    const { error: reassignError } = await supabase
      .from("bills")
      .update({ category_id: reassignToCategoryId })
      .eq("category_id", id);

    if (reassignError) throw toPortugueseCategoryError(reassignError);
  }

  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw toPortugueseCategoryError(error);
}
