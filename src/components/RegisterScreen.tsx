import { useState, type FormEvent } from "react";
import { brandLogoUrl } from "../config/brandAssets";
import { useTranslation } from "../i18n";
import { SocialLoginButtons } from "./auth/SocialLoginButtons";
import { LoginBackgroundAnimation } from "./auth/LoginBackgroundAnimation";
import { AuthPasswordField } from "./auth/AuthPasswordField";
import { LegalDocumentModal } from "./legal/LegalDocumentModal";
import type { LegalDocumentId } from "../data/legalDocuments";
import { legalConfig } from "../config/legalConfig";
import type { AuthServiceErrorCode } from "../services/authService";
import { authErrorI18nKey } from "../services/auth/authErrorMap";

type RegisterScreenProps = {
  theme: "light" | "dark";
  loading: boolean;
  error: string | null;
  errorCode?: AuthServiceErrorCode | null;
  notice?: string | null;
  onSubmit: (email: string, password: string, displayName: string, acceptedLegalVersion: string) => Promise<void>;
  onSwitchToLogin: () => void;
};

export function RegisterScreen({ theme, loading, error, errorCode = null, notice, onSubmit, onSwitchToLogin }: RegisterScreenProps) {
  const { t } = useTranslation("auth");
  const displayError = errorCode ? t(authErrorI18nKey(errorCode)) : error;
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [openLegalDocument, setOpenLegalDocument] = useState<LegalDocumentId | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    setLocalError(null);

    if (!acceptedLegal) {
      setLocalError(t("register.error.legalRequired"));
      return;
    }

    if (password !== confirmPassword) {
      setLocalError(t("register.error.passwordMismatch"));
      return;
    }

    if (password.length < 8) {
      setLocalError(t("register.error.passwordTooShort", { count: 8 }));
      return;
    }

    await onSubmit(email, password, displayName, legalConfig.currentVersion);
  };

  return (
    <main className="auth-desktop-frame auth-desktop-frame--compact" aria-label={t("register.frameAria")}>
      <LoginBackgroundAnimation theme={theme} />

      <form className="auth-card auth-card--elevated" onSubmit={submit}>
        <div className="auth-card-brand">
          <img className="picom-brand-logo" src={brandLogoUrl} alt="" />
          <div>
            <h2>{t("register.title")}</h2>
            <p className="auth-card-subtitle">{t("register.subtitle")}</p>
          </div>
        </div>

        <label className="auth-field">
          <span>{t("field.displayName")}</span>
          <input
            type="text"
            autoComplete="name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder={t("field.displayName.placeholder")}
            required
            disabled={loading}
          />
        </label>

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
          autoComplete="new-password"
          placeholder={t("field.newPassword.placeholder")}
          required
          disabled={loading}
        />

        <AuthPasswordField
          label={t("field.confirmPassword")}
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
          placeholder={t("field.confirmPassword.placeholder")}
          required
          disabled={loading}
        />

        <label className="legal-acceptance-row">
          <input type="checkbox" checked={acceptedLegal} onChange={(event) => setAcceptedLegal(event.target.checked)} required disabled={loading} />
          <span>
            {t("register.legal.agreePrefix")}{" "}
            <button type="button" onClick={() => setOpenLegalDocument("terms")}>{t("legal.link.terms")}</button>
            {t("register.legal.agreeSeparator")}{" "}
            <button type="button" onClick={() => setOpenLegalDocument("privacy")}>{t("legal.link.privacy")}</button>
            {t("register.legal.agreeSuffix")}
          </span>
        </label>

        {localError || displayError ? <div className="auth-error" role="alert">{localError ?? displayError}</div> : null}
        {!localError && !displayError && notice ? <div className="auth-success" role="status">{notice}</div> : null}

        <button className="auth-submit" type="submit" disabled={loading || !acceptedLegal}>
          {loading ? t("register.submitting") : t("register.submit")}
        </button>

        <SocialLoginButtons disabled={loading || !acceptedLegal} layout="stacked" />

        <div className="auth-card-footer">
          <button className="auth-text-link auth-text-link--strong" type="button" disabled={loading} onClick={onSwitchToLogin}>
            {t("register.haveAccount")}
          </button>
        </div>
      </form>
      {openLegalDocument ? <LegalDocumentModal documentId={openLegalDocument} onClose={() => setOpenLegalDocument(null)} /> : null}
    </main>
  );
}
