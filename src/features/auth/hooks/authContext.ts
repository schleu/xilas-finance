import type { Session } from "@supabase/supabase-js";
import { createContext } from "react";

export type AuthContextValue = {
  session: Session | null;
  isLoading: boolean;
  needsPasswordSetup: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  completePasswordSetup: (password: string) => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
