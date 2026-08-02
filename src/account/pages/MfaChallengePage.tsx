import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FormStatus } from "../components/FormStatus";
import { SUPPORT_ORIGIN } from "../config";
import { t } from "../i18n/messages";
import { resolvePostLoginDestination } from "../lib/postLogin";
import { getAccountSupabase } from "../lib/supabase";
import { useAuth } from "../lib/session";
import { ROUTES } from "../routes";

/**
 * Post-password MFA challenge (AAL1 → AAL2). Enrollment lives under /account/security/mfa.
 */
export function MfaChallengePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { session } = useAuth();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = getAccountSupabase();
      const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (cancelled) return;
      if (!aal.error && aal.data.currentLevel === "aal2") {
        if (!session) {
          navigate(ROUTES.login, { replace: true });
          return;
        }
        const destination = await resolvePostLoginDestination(session, params.get("returnTo"));
        navigate(destination.path, { replace: true });
        return;
      }
      const listed = await supabase.auth.mfa.listFactors();
      const totp = listed.data?.totp?.[0] ?? listed.data?.all?.find((f) => f.factor_type === "totp" && f.status === "verified");
      if (!totp) {
        setError(t("mfa.challenge.noFactor"));
        setLoading(false);
        return;
      }
      setFactorId(totp.id);
      setLoading(false);
    })().catch(() => {
      if (!cancelled) {
        setError(t("common.error"));
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [navigate, params, session]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!factorId || busy) return;
    setBusy(true);
    setError(null);
    const supabase = getAccountSupabase();
    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error || !challenge.data) {
      setBusy(false);
      setError(challenge.error?.message ?? t("common.error"));
      return;
    }
    const verified = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.data.id,
      code: code.trim(),
    });
    if (verified.error) {
      setBusy(false);
      setError(t("mfa.challenge.invalid"));
      setCode("");
      return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setBusy(false);
      setError(t("common.error"));
      return;
    }
    const destination = await resolvePostLoginDestination(sessionData.session, params.get("returnTo"));
    setBusy(false);
    navigate(destination.path, { replace: true });
  };

  if (loading) {
    return <div className="ac-status ac-status--loading">{t("common.loading")}</div>;
  }

  return (
    <section className="ac-card">
      <h1>{t("mfa.challenge.title")}</h1>
      <p className="ac-muted">{t("mfa.challenge.subtitle")}</p>
      <form className="ac-form" onSubmit={onSubmit}>
        <label className="ac-field">
          <span>{t("mfa.code")}</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={8}
            required
            value={code}
            disabled={busy || !factorId}
            onChange={(e) => setCode(e.target.value)}
          />
        </label>
        <FormStatus tone="error" message={error} />
        <button className="ac-btn ac-btn--primary" type="submit" disabled={busy || !factorId}>
          {busy ? t("form.working") : t("mfa.challenge.submit")}
        </button>
      </form>
      <p className="ac-muted">
        <a href={`${SUPPORT_ORIGIN}/account-access?source=account`}>{t("mfa.challenge.lost")}</a>
      </p>
    </section>
  );
}
