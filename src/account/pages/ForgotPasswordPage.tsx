import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { AuthSplitLayout } from "../components/AuthSplitLayout";
import { FormStatus } from "../components/FormStatus";
import { ACCOUNT_AUTH } from "../config";
import { t } from "../i18n/messages";
import { getAccountSupabase } from "../lib/supabase";
import { ROUTES } from "../routes";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    const supabase = getAccountSupabase();
    await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: ACCOUNT_AUTH.resetPasswordUrl,
    });
    setLoading(false);
    setDone(true);
  };

  return (
    <AuthSplitLayout
      eyebrow={t("forgot.hero.eyebrow")}
      title={t("forgot.hero.title")}
      subtitle={t("forgot.hero.subtitle")}
    >
      <div className="ac-auth-card-head">
        <p className="eyebrow">{t("brand.account")}</p>
        <h2>{t("forgot.title")}</h2>
        <p className="ac-muted">{t("forgot.subtitle")}</p>
      </div>

      {done ? (
        <div className="ac-auth-success-panel">
          <FormStatus tone="success" message={t("forgot.success")} />
          <p className="ac-muted ac-auth-success-panel__hint">{t("forgot.checkInbox")}</p>
          <Link className="ac-btn ac-btn--primary ac-btn--block ac-btn--auth" to={ROUTES.login}>
            {t("home.login")}
          </Link>
        </div>
      ) : (
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
              />
            </span>
          </label>

          <p className="ac-auth-secure-note">{t("forgot.secureNote")}</p>

          <button className="ac-btn ac-btn--primary ac-btn--block ac-btn--auth" type="submit" disabled={loading}>
            {loading ? t("form.working") : t("forgot.submit")}
          </button>
        </form>
      )}

      <p className="ac-auth-card-footer-note">
        <Link to={ROUTES.login}>{t("forgot.backToLogin")}</Link>
      </p>
    </AuthSplitLayout>
  );
}
