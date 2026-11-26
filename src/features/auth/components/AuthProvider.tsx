import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  getSession,
  hasPasswordSetupParams,
  onAuthStateChange,
  resetPasswordForEmail,
  signInWithPassword,
  signOut as signOutApi,
  updatePassword,
} from "@/features/auth/api/authApi";
import { AuthContext, type AuthContextValue } from "@/features/auth/hooks/authContext";

type Props = { children: ReactNode };

export function AuthProvider({ children }: Props) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(() =>
    hasPasswordSetupParams(window.location),
  );

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChange((event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setIsLoading(false);

      if (event === "PASSWORD_RECOVERY") {
        setNeedsPasswordSetup(true);
      } else if (event === "SIGNED_OUT") {
        setNeedsPasswordSetup(false);
        queryClient.clear();
      }
    });

    getSession()
      .then((initialSession) => {
        if (!active) return;
        setSession(initialSession);
        setIsLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setSession(null);
        setIsLoading(false);
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [queryClient]);

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithPassword(email, password);
  }, []);

  const signOut = useCallback(async () => {
    await signOutApi();
    setSession(null);
    setNeedsPasswordSetup(false);
    queryClient.clear();
  }, [queryClient]);

  const requestPasswordReset = useCallback(async (email: string) => {
    await resetPasswordForEmail(email, `${window.location.origin}/definir-senha`);
  }, []);

  const completePasswordSetup = useCallback(async (password: string) => {
    await updatePassword(password);
    setNeedsPasswordSetup(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isLoading,
      needsPasswordSetup,
      signIn,
      signOut,
      requestPasswordReset,
      completePasswordSetup,
    }),
    [
      session,
      isLoading,
      needsPasswordSetup,
      signIn,
      signOut,
      requestPasswordReset,
      completePasswordSetup,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
