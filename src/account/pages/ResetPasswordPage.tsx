import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { AuthSplitLayout } from "../components/AuthSplitLayout";
import { FormStatus } from "../components/FormStatus";
import { ACCOUNT_AUTH } from "../config";
import { t } from "../i18n/messages";
import { getAccountSupabase } from "../lib/supabase";
import { ROUTES } from "../routes";

type ResetLinkStatus = "checking" | "valid" | "missing" | "invalid" | "expired" | "used" | "network" | "success";

function classifyResetError(message: string): ResetLinkStatus {
  const normalized = message.toLowerCase();
  if (normalized.includes("expired")) return "expired";
  if (normalized.includes("used") || normalized.includes("already")) return "used";
  if (normalized.includes("fetch") || normalized.includes("network")) return "network";
  return "invalid";
}

function statusMessage(status: ResetLinkStatus): string | null {
  if (status === "checking") return t("reset.status.checking");
  if (status === "missing") return t("reset.status.missing");
  if (status === "expired") return t("reset.status.expired");
  if (status === "used") return t("reset.status.used");
  if (status === "network") return t("status.requestFailed");
  if (status === "invalid") return t("reset.status.invalid");
  if (status === "success") return t("reset.status.success");
  return null;
}

export function ResetPasswordPage({ forcedStatus }: { forcedStatus?: Extract<ResetLinkStatus, "success" | "expired"> }) {
  const { opaqueCode } = useParams<{ opaqueCode?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const verificationStarted = useRef(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [revokeOthers, setRevokeOthers] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stateStatus = (location.state as { resetStatus?: ResetLinkStatus } | null)?.resetStatus;
  const [linkStatus, setLinkStatus] = useState<ResetLinkStatus>(
    stateStatus === "used" || stateStatus === "expired" || stateStatus === "success"
      ? stateStatus
      : (forcedStatus ?? "checking"),
  );

  useEffect(() => {
    if (forcedStatus) {
      setLinkStatus(stateStatus === "used" ? "used" : forcedStatus);
      return;
    }
    if (verificationStarted.current) return;
    verificationStarted.current = true;
    const url = new URL(window.location.href);
    const tokenHash = (url.searchParams.get("token_hash") ?? "").trim();
    const type = (url.searchParams.get("type") ?? "").trim();
    const pathCode = (opaqueCode ?? "").trim();

    // Opaque path codes are redeemed by the Account gateway (server-side). Until that
    // redeem API is live, path-only links fail closed with a safe user message — never
    // expose infrastructure errors.
    if (pathCode && !tokenHash) {
      setLinkStatus("expired");
      navigate(ROUTES.resetPasswordExpired, { replace: true });
      return;
    }

    if (!tokenHash) {
      setLinkStatus("missing");
      return;
    }
    if (type !== "recovery") {
      setLinkStatus("invalid");
      navigate(ROUTES.resetPasswordExpired, { replace: true });
      return;
    }

    window.history.replaceState({}, document.title, ROUTES.resetPassword);
    const verify = async () => {
      try {
        const { error: verifyError } = await getAccountSupabase().auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        });
        if (verifyError) {
          const classified = classifyResetError(verifyError.message);
          setLinkStatus(classified);
          if (classified === "expired" || classified === "used") {
            navigate(ROUTES.resetPasswordExpired, {
              replace: true,
              state: { resetStatus: classified },
            });
          }
          return;
        }
        setLinkStatus("valid");
      } catch {
        setLinkStatus("network");
      }
    };
    void verify();
  }, [forcedStatus, navigate, opaqueCode]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (linkStatus !== "valid" || loading) return;
    if (password !== confirm) {
      setError(t("register.passwordMismatch"));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const supabase = getAccountSupabase();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(t("status.requestFailed"));
        return;
      }
      if (revokeOthers) {
        const { error: revokeError } = await supabase.auth.signOut({ scope: "others" });
        if (revokeError) {
          setError(t("reset.error.sessionsNotClosed"));
          return;
        }
        const { error: rpcError } = await supabase.rpc("revoke_other_device_sessions");
        if (rpcError) {
          setError(t("reset.error.sessionsNotClosed"));
          return;
        }
      }
      await supabase.auth.signOut({ scope: "local" });
      setPassword("");
      setConfirm("");
      setLinkStatus("success");
      navigate(ROUTES.resetPasswordSuccess, { replace: true });
      window.setTimeout(() => {
        window.location.assign(`${ACCOUNT_AUTH.loginUrl}?password_reset=success`);
      }, 1200);
    } catch {
      setError(t("status.requestFailed"));
    } finally {
      setLoading(false);
    }
  };

  const failed = ["missing", "invalid", "expired", "used", "network"].includes(linkStatus);

  return (
    <AuthSplitLayout eyebrow={t("reset.hero.eyebrow")} title={t("reset.hero.title")} subtitle={t("reset.hero.subtitle")}>
      <div className="ac-auth-card-head">
        <p className="eyebrow">{t("brand.account")}</p>
        <h2>{t("reset.title")}</h2>
        <p className="ac-muted">{linkStatus === "valid" ? t("reset.lede") : statusMessage(linkStatus)}</p>
      </div>
      {linkStatus === "checking" ? <FormStatus tone="loading" message={statusMessage(linkStatus)} /> : null}
      {failed ? (
        <div className="ac-auth-success-panel">
          <FormStatus tone="error" message={statusMessage(linkStatus)} />
          <Link className="ac-btn ac-btn--primary ac-btn--block ac-btn--auth" to={ROUTES.forgotPassword}>Yeni sıfırlama e-postası iste</Link>
          <Link className="ac-btn ac-btn--secondary ac-btn--block ac-btn--auth" to={ROUTES.login}>Girişe dön</Link>
        </div>
      ) : null}
      {linkStatus === "success" ? (
        <div className="ac-auth-success-panel">
          <FormStatus tone="success" message={statusMessage(linkStatus)} />
          <a className="ac-btn ac-btn--primary ac-btn--block ac-btn--auth" href={`${ACCOUNT_AUTH.loginUrl}?password_reset=success`}>Girişe devam et</a>
          <a className="ac-btn ac-btn--secondary ac-btn--block ac-btn--auth" href="picom://login?password_reset=success">PICOM Desktop’u aç</a>
        </div>
      ) : null}
      {linkStatus === "valid" ? (
        <form className="ac-form ac-form--auth" onSubmit={onSubmit} noValidate>
          <label className="ac-field">
            <span>{t("password.new")}</span>
            <input type="password" autoComplete="new-password" minLength={12} required value={password} disabled={loading} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <label className="ac-field">
            <span>{t("password.confirm")}</span>
            <input type="password" autoComplete="new-password" minLength={12} required value={confirm} disabled={loading} onChange={(event) => setConfirm(event.target.value)} />
          </label>
          <label className="ac-check">
            <input type="checkbox" checked={revokeOthers} disabled={loading} onChange={(event) => setRevokeOthers(event.target.checked)} />
            <span>{t("sessions.revokeOthers")}</span>
          </label>
          <FormStatus tone="error" message={error} />
          <button className="ac-btn ac-btn--primary ac-btn--block ac-btn--auth" type="submit" disabled={loading}>{loading ? t("form.working") : t("reset.submit")}</button>
        </form>
      ) : null}
    </AuthSplitLayout>
  );
}
