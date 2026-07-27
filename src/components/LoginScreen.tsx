import { useEffect, useRef, useState, type FormEvent } from "react";
import { setAuthRememberMe } from "../services/supabase/supabaseClient";
import { brandLogoUrl } from "../config/brandAssets";
import { accountCenterUrls, isAllowedAccountCenterUrl } from "../config/accountCenterUrls";
import { externalLinkService } from "../services/desktop/externalLinkService";
import {
  generateSessionContinueNonce,
  pollSessionContinue,
} from "../services/auth/sessionContinueService";
import { AppIcon } from "./AppIcon";
import { LoginBackgroundAnimation } from "./auth/LoginBackgroundAnimation";
import { AuthHeroPanel } from "./auth/AuthHeroPanel";
import { SocialLoginButtons } from "./auth/SocialLoginButtons";

type LoginScreenProps = {
  theme: "light" | "dark";
  loading: boolean;
  error: string | null;
  notice?: string | null;
  initialEmail?: string;
  onSubmit: (email: string, password: string) => Promise<void>;
  /** Optional MFA challenge step — shown after password when AAL2 is required. */
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

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  required = false,
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  placeholder?: string;
  required?: boolean;
}>) {
  const [revealed, setRevealed] = useState(false);

  return (
    <label className="auth-field auth-field--password">
      <span>{label}</span>
      <span className="auth-password-shell">
        <input
          type={revealed ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          required={required}
        />
        <button
          type="button"
          className={`auth-password-toggle${revealed ? " is-revealed" : ""}`}
          aria-label={revealed ? "Hide password" : "Show password"}
          aria-pressed={revealed}
          onClick={() => setRevealed((current) => !current)}
        >
          <AppIcon name="eye" size="sm" />
          {revealed ? <span className="auth-password-toggle-slash" aria-hidden="true" /> : null}
        </button>
      </span>
    </label>
  );
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
  notice = null,
  initialEmail,
  onSubmit,
  mfaRequired = false,
  mfaLoading = false,
  mfaError = null,
  onVerifyMfa,
  onCancelMfa,
}: LoginScreenProps) {
  const [rememberedEmail] = useState(readRememberedEmail);
  const [email, setEmail] = useState(initialEmail?.trim() || rememberedEmail);
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(rememberedEmail !== "");
  const [mfaCode, setMfaCode] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [registerNotice, setRegisterNotice] = useState<string | null>(null);
  const registerPollAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      registerPollAbortRef.current?.abort();
    };
  }, []);

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

  const openRegister = async () => {
    setLinkError(null);
    setRegisterNotice(null);
    registerPollAbortRef.current?.abort();
    const nonce = generateSessionContinueNonce();
    const controller = new AbortController();
    registerPollAbortRef.current = controller;
    const url = accountCenterUrls.registerWithNonce(nonce, "desktop");
    const result = await openAccountUrl(url);
    if (!result.ok) {
      setLinkError(externalLinkService.getUserFriendlyError(String(result.reason)));
      return;
    }
    setRegisterNotice("Finish creating your account in the browser. Picom will sign you in automatically.");
    void pollSessionContinue(nonce, { signal: controller.signal }).then((pollResult) => {
      if (controller.signal.aborted) return;
      if (pollResult.ok) {
        setRegisterNotice("Account created — signing you in…");
        return;
      }
      setRegisterNotice(pollResult.error.message);
    });
  };

  if (mfaRequired && onVerifyMfa) {
    return (
      <main className="auth-desktop-frame" aria-label="Picom multi-factor authentication">
        <LoginBackgroundAnimation theme={theme} />
        <AuthHeroPanel variant="login" />
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
              <p className="eyebrow">Two-step verification</p>
              <h2>Enter authenticator code</h2>
            </div>
          </div>
          <p className="auth-note">Open your authenticator app and enter the 6-digit code for Picom.</p>
          <label className="auth-field">
            <span>Authentication code</span>
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
            {mfaLoading ? "Verifying…" : "Verify"}
            <AppIcon name="lock" size="sm" />
          </button>
          {onCancelMfa ? (
            <button className="auth-seed-button" type="button" disabled={mfaLoading} onClick={onCancelMfa}>
              Back to sign in
            </button>
          ) : null}
        </form>
      </main>
    );
  }

  return (
    <main className="auth-desktop-frame" aria-label="Picom sign in">
      <LoginBackgroundAnimation theme={theme} />
      <AuthHeroPanel variant="login" />

      <form className="auth-card auth-card--elevated" onSubmit={submit}>
        <div className="auth-card-brand">
          <img className="picom-brand-logo" src={brandLogoUrl} alt="" />
          <div>
            <p className="eyebrow">Sign in</p>
            <h2>Continue to Picom</h2>
          </div>
        </div>

        <label className="auth-field">
          <span>Email</span>
          <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" required />
        </label>

        <PasswordField
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          placeholder="Enter your password"
          required
        />

        {error ? (
          <div className="auth-error" role="alert">
            {error}
          </div>
        ) : null}
        {!error && notice ? (
          <div className="auth-success" role="status">
            {notice}
          </div>
        ) : null}
        {linkError ? (
          <div className="auth-error" role="alert">
            {linkError}
          </div>
        ) : null}
        {!error && !notice && registerNotice ? (
          <div className="auth-success" role="status">
            {registerNotice}
          </div>
        ) : null}

        <div className="auth-options-row">
          <label className="auth-remember">
            <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
            <span>Remember me</span>
          </label>
          <button className="auth-secondary-link" type="button" onClick={() => void openLink(accountCenterUrls.forgotPassword)}>
            Forgot password?
          </button>
        </div>

        <button className="auth-submit" type="submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
          <AppIcon name="send" size="sm" />
        </button>

        <SocialLoginButtons disabled={loading} layout="stacked" />

        <div className="auth-card-footer">
          <button className="auth-text-link auth-text-link--strong" type="button" onClick={() => void openRegister()}>
            Create an account
          </button>
          <div className="auth-legal-links">
            <button className="auth-text-link" type="button" onClick={() => void openLink(accountCenterUrls.privacy)}>
              Privacy
            </button>
            <button className="auth-text-link" type="button" onClick={() => void openLink(accountCenterUrls.terms)}>
              Terms
            </button>
            <button className="auth-text-link" type="button" onClick={() => void openLink(accountCenterUrls.support)}>
              Support Center
            </button>
          </div>
        </div>
      </form>
    </main>
  );
}
