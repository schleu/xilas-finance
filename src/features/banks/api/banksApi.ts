import type { PostgrestError } from "@supabase/supabase-js";
import { bankSchema, type BankInput } from "@/features/banks/schemas/bankSchema";
import { getSupabase } from "@/lib/supabase";

export type Bank = {
  id: string;
  user_id: string;
  name: string;
  has_debit_account: boolean;
  agency: string | null;
  account_number: string | null;
  has_credit_card: boolean;
  credit_card_label: string | null;
  credit_card_due_day: number | null;
  created_at: string;
  updated_at: string;
};

const BANK_SELECT =
  "id, user_id, name, has_debit_account, agency, account_number, has_credit_card, credit_card_label, credit_card_due_day, created_at, updated_at";

function toPortugueseBankError(error: PostgrestError): Error {
  if (error.code === "23514") {
    return new Error("Dados inválidos para o banco. Verifique agência, conta e vencimento.");
  }
  return new Error("Não foi possível concluir a operação no banco. Tente novamente.");
}

export async function listBanks(): Promise<Bank[]> {
  const { data, error } = await getSupabase()
    .from("banks")
    .select(BANK_SELECT)
    .order("name", { ascending: true });
  if (error) throw toPortugueseBankError(error);
  return (data ?? []) as Bank[];
}

export async function createBank(input: BankInput): Promise<Bank> {
  const parsed = bankSchema.parse(input);
  const { data, error } = await getSupabase()
    .from("banks")
    .insert(parsed)
    .select(BANK_SELECT)
    .single();
  if (error) throw toPortugueseBankError(error);
  return data as Bank;
}

export async function updateBank(id: string, input: BankInput): Promise<Bank> {
  const parsed = bankSchema.parse(input);
  const { data, error } = await getSupabase()
    .from("banks")
    .update({ ...parsed, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(BANK_SELECT)
    .single();
  if (error) throw toPortugueseBankError(error);
  return data as Bank;
}

export async function deleteBank(id: string): Promise<void> {
  const { error } = await getSupabase().from("banks").delete().eq("id", id);
  if (error) throw toPortugueseBankError(error);
}
