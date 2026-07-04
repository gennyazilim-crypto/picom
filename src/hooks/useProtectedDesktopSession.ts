import { useCallback, useEffect, useState } from "react";
import { authService, type AuthServiceSession } from "../services/authService";
import { loggingService } from "../services/loggingService";

type NoticeTone = "info" | "success" | "error";
type NoticeCallback = (message: string, tone?: NoticeTone) => void;

export function useProtectedDesktopSession(notify?: NoticeCallback) {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<AuthServiceSession | null>(null);

  useEffect(() => {
    let alive = true;

    authService.getCurrentSession().then((result) => {
      if (!alive) return;

      if (result.ok) {
        setSession(result.data);
      } else {
        loggingService.logWarn("Auth session check failed", { code: result.error.code });
        setError(result.error.message);
      }

      setReady(true);
    });

    const unsubscribe = authService.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === "SIGNED_OUT") setError(null);
    });

    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);

    const result = await authService.signInWithEmailPassword(email, password);
    if (result.ok) {
      setSession(result.data);
      notify?.("Signed in to Picom.", "success");
    } else {
      loggingService.logWarn("Auth sign-in failed", { code: result.error.code });
      setError(result.error.message);
    }

    setLoading(false);
  }, [notify]);

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    setLoading(true);
    setError(null);

    const result = await authService.signUpWithEmailPassword(email, password, displayName);
    if (result.ok) {
      setSession(result.data);
      notify?.("Picom account created.", "success");
    } else {
      loggingService.logWarn("Auth register failed", { code: result.error.code });
      setError(result.error.message);
    }

    setLoading(false);
  }, [notify]);

  const signOut = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await authService.signOut();
    if (result.ok) {
      setSession(null);
      notify?.("Signed out.", "info");
    } else {
      loggingService.logWarn("Auth sign-out failed", { code: result.error.code });
      setError(result.error.message);
    }

    setLoading(false);
  }, [notify]);

  return {
    ready,
    loading,
    error,
    session,
    authenticated: Boolean(session),
    signIn,
    register,
    signOut,
    clearError: () => setError(null),
  } as const;
}