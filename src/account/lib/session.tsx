import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getAccountSupabase } from "./supabase";

type AuthContextValue = {
  /** False until the first getSession() / auth event settles — do not redirect while false. */
  initialized: boolean;
  session: Session | null;
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  requireAuth: () => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const supabase = getAccountSupabase();
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
      setInitialized(true);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, next) => {
      // PASSWORD_RECOVERY is a valid session for reset-password; keep it.
      // TOKEN_REFRESHED must not clear UI state — only update the session object.
      if (event === "SIGNED_OUT") {
        setSession(null);
      } else {
        setSession(next);
      }
      setLoading(false);
      setInitialized(true);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getAccountSupabase();
    await supabase.auth.signOut({ scope: "local" });
    setSession(null);
  }, []);

  const refreshSession = useCallback(async () => {
    const supabase = getAccountSupabase();
    const { data } = await supabase.auth.getSession();
    setSession(data.session);
  }, []);

  const requireAuth = useCallback(() => Boolean(session?.user), [session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      initialized,
      session,
      user: session?.user ?? null,
      loading: loading || !initialized,
      isAuthenticated: Boolean(session?.user),
      signOut,
      refreshSession,
      requireAuth,
    }),
    [initialized, session, loading, signOut, refreshSession, requireAuth],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
