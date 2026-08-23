import { FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthSplitLayout } from "../components/AuthSplitLayout";
import { AccountSocialLoginButtons } from "../components/AccountSocialLoginButtons";
import { FormStatus } from "../components/FormStatus";
import { SUPPORT_HOME_URL } from "../config";
import { t } from "../i18n/messages";
import { resolvePostLoginDestination } from "../lib/postLogin";
import { getAccountSupabase } from "../lib/supabase";
import { ROUTES } from "../routes";
import { trackMarketingEvent } from "../../services/marketing/marketingEvents";

export function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const passwordChanged = params.get("passwordChanged") === "true";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading) return;

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setError(t("login.missingFields"));
      return;
    }

    setLoading(true);
    setError(null);
    const supabase = getAccountSupabase();

    try {
      localStorage.setItem("picom.account.rememberMe", rememberMe ? "true" : "false");
    } catch {
      // ignore
    }

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (signInError || !data.session) {
      setLoading(false);
      const message = String(signInError?.message ?? "");
      if (/email not confirmed|not verified/i.test(message)) {
        setError(t("login.confirmEmailMisconfigured"));
        return;
      }
      if (/too many|rate limit/i.test(message)) {
        setError(t("login.rateLimited"));
        return;
      }
      setError(t("login.invalid"));
      return;
    }

    try {
      await supabase.rpc("register_current_device_session", {
        target_device_id: `web-${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`,
        target_device_label: "PICOM Account Center",
        target_platform_label: navigator.platform?.slice(0, 40) || "web",
        target_runtime_label: "account-web",
      });
    } catch {
      // optional best-effort session registration
    }

    const destination = await resolvePostLoginDestination(data.session, params.get("returnTo"));
    if (destination.reason === "overview" || destination.reason === "return_to") {
      const { continueToProduct, captureContinueContextFromLocation } = await import("../lib/continueToProduct");
      captureContinueContextFromLocation(window.location.search);
      const continued = await continueToProduct(data.session);
      if (continued.redirected) {
        setLoading(false);
        return;
      }
    }
    setLoading(false);
    navigate(destination.path, { replace: true });
  };

  return (
    <AuthSplitLayout>
      <div className="ac-auth-card-head">
        <p className="eyebrow">{t("login.eyebrow")}</p>
        <h2>{t("login.title")}</h2>
        <p className="ac-muted">{t("login.subtitle")}</p>
      </div>

      {passwordChanged ? <FormStatus tone="success" message={t("reset.success")} /> : null}

      <form className="ac-form ac-form--auth" onSubmit={onSubmit} noValidate>
        <label className="ac-field">
          <span>{t("common.email")}</span>
          <span className="ac-input-shell">
            <span className="ac-input-shell__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
                <path d="m4.5 7.5 7.5 5.5 7.5-5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <input
              type="email"
              autoComplete="email"
              inputMode="email"
              required
              placeholder="you@example.com"
              value={email}
              disabled={loading}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "login-error" : undefined}
            />
          </span>
        </label>

        <label className="ac-field ac-field--password">
          <span>{t("common.password")}</span>
          <span className="ac-input-shell ac-password-shell">
            <span className="ac-input-shell__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                <rect x="5" y="10" width="14" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
                <path d="M8.5 10V7.8a3.5 3.5 0 0 1 7 0V10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </span>
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              placeholder="••••••••••••"
              value={password}
              disabled={loading}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="ac-password-toggle"
              aria-pressed={showPassword}
              aria-label={showPassword ? t("login.hidePassword") : t("login.showPassword")}
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? t("login.hidePassword") : t("login.showPassword")}
            </button>
          </span>
        </label>

        <div className="ac-options-row">
          <label className="ac-check">
            <input
              type="checkbox"
              checked={rememberMe}
              disabled={loading}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <span>{t("login.remember")}</span>
          </label>
          <Link className="ac-text-link" to={ROUTES.forgotPassword}>{t("login.forgot")}</Link>
        </div>

        <div id="login-error">
          <FormStatus tone="error" message={error} />
        </div>

        <button className="ac-btn ac-btn--primary ac-btn--block ac-btn--auth" type="submit" disabled={loading}>
          {loading ? t("form.working") : t("login.submit")}
        </button>
      </form>

      <AccountSocialLoginButtons disabled={loading} />

      <div className="ac-auth-card-divider" role="separator" aria-hidden="true">
        <span>{t("login.or")}</span>
      </div>

      <div className="ac-auth-card-footer">
        <Link className="ac-btn ac-btn--secondary ac-btn--block" to={ROUTES.register} onClick={() => trackMarketingEvent("signup_cta_clicked")}>
          {t("login.registerLink")}
        </Link>
        <a className="ac-text-link ac-text-link--center" href={SUPPORT_HOME_URL}>{t("login.help")}</a>
      </div>
    </AuthSplitLayout>
  );
}
