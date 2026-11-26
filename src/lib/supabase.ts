import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/** Cliente do navegador: usa só a chave anon; a segurança vem da RLS (constituição, princípio 3). */
export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = import.meta.env.VITE_FINANCE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_FINANCE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Defina VITE_FINANCE_SUPABASE_URL e VITE_FINANCE_SUPABASE_ANON_KEY (veja .env.example).",
    );
  }
  client = createClient(url, anonKey);
  return client;
}
