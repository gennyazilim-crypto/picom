import { useState, type FormEvent } from "react";
import { brandLogoUrl } from "../../config/brandAssets";
import { useTranslation } from "../../i18n";
import { authService } from "../../services/authService";
import { authErrorI18nKey } from "../../services/auth/authErrorMap";
import { LoginBackgroundAnimation } from "./LoginBackgroundAnimation";

type ForgotPasswordScreenProps = Readonly<{
  theme: "light" | "dark";
  onBack: () => void;
}>;

export function ForgotPasswordScreen({ theme, onBack }: ForgotPasswordScreenProps) {
  const { t } = useTranslation("auth");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading || done) return;
    setError(null);
    setLoading(true);
    const result = await authService.requestPasswordReset(email);
    setLoading(false);
    if (!result.ok) {
      setError(t(authErrorI18nKey(result.error.code)));
      return;
    }
    setDone(true);
  };

  return (
    <main className="auth-desktop-frame auth-desktop-frame--compact" aria-label={t("recovery.frameAria")}>
      <LoginBackgroundAnimation theme={theme} />
      <form className="auth-card auth-card--elevated" onSubmit={submit}>
        <div className="auth-card-brand">
          <img className="picom-brand-logo" src={brandLogoUrl} alt="" />
          <div>
            <h2>{t("recovery.title")}</h2>
            <p className="auth-card-subtitle">{t("recovery.subtitle")}</p>
          </div>
        </div>

        {done ? (
          <div className="auth-success" role="status">
            {t("recovery.success")}
          </div>
        ) : (
          <label className="auth-field">
            <span>{t("field.email")}</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t("field.email.placeholder")}
              required
              disabled={loading}
            />
          </label>
        )}

        {error ? (
          <div className="auth-error" role="alert">
            {error}
          </div>
        ) : null}

        {done ? null : (
          <button className="auth-submit" type="submit" disabled={loading || !email.trim()}>
            {loading ? t("recovery.submitting") : t("recovery.submit")}
          </button>
        )}

        <div className="auth-card-footer">
          <button className="auth-text-link auth-text-link--strong" type="button" onClick={onBack}>
            {t("recovery.back")}
          </button>
        </div>
      </form>
    </main>
  );
}
