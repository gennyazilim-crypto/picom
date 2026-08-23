import { useState, type FormEvent } from "react";
import { setAuthRememberMe } from "../services/supabase/supabaseClient";
import { useTranslation } from "../i18n";
import { brandLogoUrl } from "../config/brandAssets";
import { accountCenterUrls, isAllowedAccountCenterUrl } from "../config/accountCenterUrls";
import { externalLinkService } from "../services/desktop/externalLinkService";
import type { AuthServiceErrorCode } from "../services/authService";
import { authErrorI18nKey } from "../services/auth/authErrorMap";
import { AppIcon } from "./AppIcon";
import { LoginBackgroundAnimation } from "./auth/LoginBackgroundAnimation";
import { SocialLoginButtons } from "./auth/SocialLoginButtons";
import { AuthPasswordField } from "./auth/AuthPasswordField";

type LoginScreenProps = {
  theme: "light" | "dark";
  loading: boolean;
  error: string | null;
  errorCode?: AuthServiceErrorCode | null;
  notice?: string | null;
  initialEmail?: string;
  onSubmit: (email: string, password: string) => Promise<void>;
  onCreateAccount: () => void;
  onForgotPassword: () => void;
  mfaRequired?: boolean;
  mfaLoading?: boolean;
  mfaError?: string | null;
  onVerifyMfa?: (code: string) => Promise<void>;
  onCancelMfa?: () => void;
};

const REMEMBER_EMAIL_KEY = "picom.auth.rememberedEmail";

function readRememberedEmail(): string {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem(REMEMBER_EMAIL_KEY) ?? "";
}

async function openAccountUrl(url: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!isAllowedAccountCenterUrl(url)) {
    return { ok: false, reason: "UNSAFE_EXTERNAL_URL" };
  }
  return externalLinkService.openExternalUrl(url);
}

export function LoginScreen({
  theme,
  loading,
  error,
  errorCode = null,
  notice = null,
  initialEmail,
  onSubmit,
  onCreateAccount,
  onForgotPassword,
  mfaRequired = false,
  mfaLoading = false,
  mfaError = null,
  onVerifyMfa,
  onCancelMfa,
}: LoginScreenProps) {
  const { t } = useTranslation("auth");
  const displayError = errorCode ? t(authErrorI18nKey(errorCode)) : error;
  const [rememberedEmail] = useState(readRememberedEmail);
  const [email, setEmail] = useState(initialEmail?.trim() || rememberedEmail);
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(rememberedEmail !== "");
  const [mfaCode, setMfaCode] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    setAuthRememberMe(rememberMe);
    if (typeof localStorage !== "undefined") {
      if (rememberMe) localStorage.setItem(REMEMBER_EMAIL_KEY, email.trim());
      else localStorage.removeItem(REMEMBER_EMAIL_KEY);
    }
    await onSubmit(email, password);
  };

  const openLink = async (url: string) => {
    setLinkError(null);
    const result = await openAccountUrl(url);
    if (!result.ok) {
      setLinkError(externalLinkService.getUserFriendlyError(String(result.reason)));
    }
  };

  if (mfaRequired && onVerifyMfa) {
    return (
      <main className="auth-desktop-frame auth-desktop-frame--compact" aria-label={t("login.mfa.frameAria")}>
        <LoginBackgroundAnimation theme={theme} />
        <form
          className="auth-card auth-card--elevated"
          onSubmit={(event) => {
            event.preventDefault();
            if (mfaLoading) return;
            void onVerifyMfa(mfaCode.trim());
          }}
        >
          <div className="auth-card-brand">
            <img className="picom-brand-logo" src={brandLogoUrl} alt="" />
            <div>
              <p className="eyebrow">{t("login.mfa.eyebrow")}</p>
              <h2>{t("login.mfa.title")}</h2>
            </div>
          </div>
          <p className="auth-note">{t("login.mfa.note")}</p>
          <label className="auth-field">
            <span>{t("login.mfa.codeLabel")}</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={mfaCode}
              onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              required
            />
          </label>
          {mfaError ? (
            <div className="auth-error" role="alert">
              {mfaError}
            </div>
          ) : null}
          <button className="auth-submit" type="submit" disabled={mfaLoading || mfaCode.length !== 6}>
            {mfaLoading ? t("login.mfa.verifying") : t("login.mfa.verify")}
            <AppIcon name="lock" size="sm" />
          </button>
          {onCancelMfa ? (
            <button className="auth-seed-button" type="button" disabled={mfaLoading} onClick={onCancelMfa}>
              {t("login.mfa.back")}
            </button>
          ) : null}
        </form>
      </main>
    );
  }

  return (
    <main className="auth-desktop-frame auth-desktop-frame--compact" aria-label={t("login.frameAria")}>
      <LoginBackgroundAnimation theme={theme} />

      <form className="auth-card auth-card--elevated" onSubmit={submit}>
        <div className="auth-card-brand">
          <img className="picom-brand-logo" src={brandLogoUrl} alt="" />
          <div>
            <h2>{t("login.title")}</h2>
            <p className="auth-card-subtitle">{t("login.subtitle")}</p>
          </div>
        </div>

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

        <AuthPasswordField
          label={t("field.password")}
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          placeholder={t("field.password.placeholder")}
          required
          disabled={loading}
        />

        {displayError ? (
          <div className="auth-error" role="alert">
            {displayError}
          </div>
        ) : null}
        {!displayError && notice ? (
          <div className="auth-success" role="status">
            {notice}
          </div>
        ) : null}
        {linkError ? (
          <div className="auth-error" role="alert">
            {linkError}
          </div>
        ) : null}

        <div className="auth-options-row">
          <label className="auth-remember">
            <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} disabled={loading} />
            <span>{t("login.rememberMe")}</span>
          </label>
          <button className="auth-secondary-link" type="button" disabled={loading} onClick={onForgotPassword}>
            {t("login.forgotPassword")}
          </button>
        </div>

        <button className="auth-submit" type="submit" disabled={loading}>
          {loading ? t("login.submitting") : t("login.submit")}
        </button>

        <SocialLoginButtons disabled={loading} layout="stacked" />

        <div className="auth-card-footer">
          <p className="auth-switch-row">
            <span>{t("login.noAccount")}</span>
            <button className="auth-text-link auth-text-link--strong" type="button" disabled={loading} onClick={onCreateAccount}>
              {t("login.createAccount")}
            </button>
          </p>
          <div className="auth-legal-links">
            <button className="auth-text-link" type="button" onClick={() => void openLink(accountCenterUrls.privacy)}>
              {t("login.legal.privacy")}
            </button>
            <button className="auth-text-link" type="button" onClick={() => void openLink(accountCenterUrls.terms)}>
              {t("login.legal.terms")}
            </button>
            <button className="auth-text-link" type="button" onClick={() => void openLink(accountCenterUrls.support)}>
              {t("login.legal.support")}
            </button>
          </div>
        </div>
      </form>
    </main>
  );
}
