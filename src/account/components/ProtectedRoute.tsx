import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { t } from "../i18n/messages";
import { useAuth } from "../lib/session";
import { getAccountSupabase } from "../lib/supabase";
import { ROUTES } from "../routes";

/**
 * Soft email verification is never a login gate.
 * MFA AAL2 is required before account shell when enrolled factors demand it.
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, initialized } = useAuth();
  const location = useLocation();
  const [mfaPending, setMfaPending] = useState<boolean | null>(null);

  useEffect(() => {
    if (!session || location.pathname === ROUTES.mfaChallenge) {
      setMfaPending(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const aal = await getAccountSupabase().auth.mfa.getAuthenticatorAssuranceLevel();
        if (cancelled) return;
        const needs =
          !aal.error
          && aal.data.currentLevel === "aal1"
          && aal.data.nextLevel === "aal2";
        setMfaPending(Boolean(needs));
      } catch {
        if (!cancelled) setMfaPending(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, location.pathname]);

  if (!initialized || loading) {
    return <div className="ac-status ac-status--loading">{t("protected.redirect")}</div>;
  }

  if (!session) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`${ROUTES.login}?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  if (location.pathname !== ROUTES.mfaChallenge && mfaPending === null) {
    return <div className="ac-status ac-status--loading">{t("protected.redirect")}</div>;
  }

  if (mfaPending && location.pathname !== ROUTES.mfaChallenge) {
    const returnTo = `${location.pathname}${location.search}`;
    return <Navigate to={`${ROUTES.mfaChallenge}?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  return <>{children}</>;
}
