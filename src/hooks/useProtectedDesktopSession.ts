import { useCallback, useEffect, useRef, useState } from "react";
import { authService, type AuthServiceSession } from "../services/authService";
import { loggingService } from "../services/loggingService";
import { multiClientSessionSyncService } from "../services/multiClientSessionSyncService";
import { accountActivityService } from "../services/accountActivityService";
import { sessionManagementService } from "../services/sessionManagementService";

type NoticeTone = "info" | "success" | "error";
type NoticeCallback = (message: string, tone?: NoticeTone) => void;

export function useProtectedDesktopSession(notify?: NoticeCallback) {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<AuthServiceSession | null>(null);
  const sessionRef = useRef<AuthServiceSession | null>(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

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

    const unsubscribeSync = multiClientSessionSyncService.subscribe((event) => {
      const currentSession = sessionRef.current;
      if (event.type !== "user:session_revoked") {
        loggingService.logInfo("Multi-client user state sync placeholder", {
          type: event.type,
          userId: event.userId,
          communityId: event.communityId,
          changedKeys: event.changedKeys
        }, "multi-client-sync");
        return;
      }

      if (currentSession?.user?.id && event.userId !== currentSession.user.id) {
        return;
      }

      const message = multiClientSessionSyncService.getUserFacingSessionRevokedMessage();
      loggingService.logWarn("Current desktop session revoked by multi-client sync", {
        eventId: event.id,
        userId: event.userId,
        sessionId: event.sessionId,
        reason: event.reason
      }, "multi-client-sync");

      accountActivityService.recordActivity({
        type: "session_revoked",
        userId: event.userId,
        metadata: {
          source: "multi_client_sync",
          reason: event.reason ?? "revoked_placeholder"
        }
      });

      void authService.signOut().finally(() => {
        if (!alive) return;
        setSession(null);
        setError(message);
        notify?.(message, "error");
      });
    });

    return () => {
      alive = false;
      unsubscribe();
      unsubscribeSync();
    };
  }, [notify]);

  useEffect(()=>{const userId=session?.user?.id;if(!userId||session.provider!=="supabase")return;void sessionManagementService.ensureCurrentSessionRegistered();return sessionManagementService.subscribeToCurrentSessionRevocation(userId,()=>{multiClientSessionSyncService.emitLocalPlaceholder({type:"user:session_revoked",userId,reason:"device_session_revoked"})})},[session?.provider,session?.user?.id]);

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);

    const result = await authService.signInWithEmailPassword(email, password);
    if (result.ok) {
      setSession(result.data);
      accountActivityService.recordActivity({
        type: "login_success",
        userId: result.data.user?.id ?? null,
        metadata: { provider: result.data.provider }
      });
      notify?.("Signed in to Picom.", "success");
    } else {
      loggingService.logWarn("Auth sign-in failed", { code: result.error.code });
      setError(result.error.message);
    }

    setLoading(false);
  }, [notify]);

  const register = useCallback(async (email: string, password: string, displayName: string, acceptedLegalVersion: string) => {
    setLoading(true);
    setError(null);

    const result = await authService.signUpWithEmailPassword(email, password, displayName, acceptedLegalVersion);
    if (result.ok) {
      setSession(result.data);
      accountActivityService.recordActivity({
        type: "login_success",
        userId: result.data.user?.id ?? null,
        metadata: { provider: result.data.provider, signup: true }
      });
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
      accountActivityService.recordActivity({
        type: "logout",
        userId: sessionRef.current?.user?.id ?? null,
        metadata: { provider: sessionRef.current?.provider ?? "unknown" }
      });
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
