import type { AuthChangeEvent, AuthError, Session } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";

function toPortugueseAuthError(error: AuthError): Error {
  const message = error.message.toLowerCase();
  if (message.includes("invalid login credentials")) {
    return new Error("E-mail ou senha inválidos.");
  }
  if (message.includes("email not confirmed")) {
    return new Error("Confirme seu e-mail antes de entrar.");
  }
  if (message.includes("new password should be different")) {
    return new Error("A nova senha precisa ser diferente da senha atual.");
  }
  if (error.status === 429) {
    return new Error("Muitas tentativas seguidas. Aguarde um instante e tente novamente.");
  }
  return new Error("Não foi possível concluir a autenticação. Tente novamente.");
}

/**
 * Identifica links de convite ou recuperação de senha na URL para direcionar
 * o usuário à tela de definição de senha antes de liberar o app.
 */
export function hasPasswordSetupParams(locationLike: { hash: string; search: string }): boolean {
  const hashParams = new URLSearchParams(locationLike.hash.replace(/^#/, ""));
  const searchParams = new URLSearchParams(locationLike.search);
  const type = hashParams.get("type") ?? searchParams.get("type");
  return type === "invite" || type === "recovery";
}

export async function getSession(): Promise<Session | null> {
  const { data, error } = await getSupabase().auth.getSession();
  if (error) throw toPortugueseAuthError(error);
  return data.session;
}

export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
): () => void {
  const { data } = getSupabase().auth.onAuthStateChange(callback);
  return () => data.subscription.unsubscribe();
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await getSupabase().auth.signInWithPassword({ email, password });
  if (error) throw toPortugueseAuthError(error);
}

export async function resetPasswordForEmail(email: string, redirectTo: string): Promise<void> {
  const { error } = await getSupabase().auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw toPortugueseAuthError(error);
}

export async function updatePassword(password: string): Promise<void> {
  const { error } = await getSupabase().auth.updateUser({ password });
  if (error) throw toPortugueseAuthError(error);
}

export async function signOut(): Promise<void> {
  const { error } = await getSupabase().auth.signOut();
  if (error) throw toPortugueseAuthError(error);
}
