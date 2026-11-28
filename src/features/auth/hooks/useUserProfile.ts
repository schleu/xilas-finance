import { useQuery } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase";

/**
 * Gera até duas iniciais maiúsculas a partir do nome de exibição ou, como fallback,
 * do prefixo do e-mail do usuário.
 */
export function getUserInitials(
  displayName?: string | null,
  email?: string | null,
): string {
  const cleanName = displayName?.trim() ?? "";
  if (cleanName) {
    const parts = cleanName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
    }
    return cleanName.slice(0, 2).toUpperCase();
  }

  const emailPrefix = (email?.split("@")[0] ?? "").trim();
  if (emailPrefix) {
    const parts = emailPrefix.split(/[._-]+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
    }
    return emailPrefix.slice(0, 2).toUpperCase();
  }

  return "US";
}

export function useUserProfile(userId?: string | null) {
  return useQuery({
    queryKey: ["user-profile", userId],
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      try {
        const { data, error } = await getSupabase()
          .from("profiles")
          .select("display_name")
          .eq("id", userId!)
          .maybeSingle();
        if (error) return null;
        return (data as { display_name: string | null } | null)?.display_name ?? null;
      } catch {
        return null;
      }
    },
  });
}
