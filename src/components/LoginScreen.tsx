import { useState, type FormEvent } from "react";
import { isMockMode } from "../config/appConfig";
import { setAuthRememberMe } from "../services/supabase/supabaseClient";
import { brandLogoUrl } from "../config/brandAssets";
import { AppIcon } from "./AppIcon";
import { SocialLoginButtons } from "./auth/SocialLoginButtons";
import { LoginBackgroundAnimation } from "./auth/LoginBackgroundAnimation";

type LoginScreenProps = {
  theme: "light" | "dark";
  loading: boolean;
  error: string | null;
  onSubmit: (email: string, password: string) => Promise<void>;
  onPasswordResetRequest: (email: string) => Promise<string>;
  recoveryMode?: boolean;
  recoveryMessage?: string | null;
  onConfirmPasswordReset?: (password: string) => Promise<{ ok: boolean; message: string }>;
  onCancelPasswordRecovery?: () => void;
  onSwitchToRegister: () => void;
};

const localSeed = {
  email: "owner@picom.local",
  password: "PicomDev123!",
};

const REMEMBER_EMAIL_KEY = "picom.auth.rememberedEmail";

function readRememberedEmail(): string {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem(REMEMBER_EMAIL_KEY) ?? "";
}

export function LoginScreen({ theme, loading, error, onSubmit, onPasswordResetRequest, recoveryMode = false, recoveryMessage, onConfirmPasswordReset, onCancelPasswordRecovery, onSwitchToRegister }: LoginScreenProps) {
  // Read persisted email once at mount, not on every render.
  const [rememberedEmail] = useState(readRememberedEmail);
  const [email, setEmail] = useState(rememberedEmail || (isMockMode ? localSeed.email : ""));
  const [password, setPassword] = useState(isMockMode ? localSeed.password : "");
  const [rememberMe, setRememberMe] = useState(rememberedEmail !== "" || !isMockMode);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState(rememberedEmail || (isMockMode ? localSeed.email : ""));
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [recoveryResult, setRecoveryResult] = useState<string | null>(null);
  const [recoverySucceeded, setRecoverySucceeded] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Guard against a double submit when the Enter key fires while a sign-in is in flight
    // (the button is disabled, but the form's submit handler still runs on Enter).
    if (loading) return;
    // Keep me signed in until an explicit sign-out when checked; drop the session
    // on app close when unchecked. The raw password is never stored.
    setAuthRememberMe(rememberMe);
    if (typeof localStorage !== "undefined") {
      if (rememberMe) localStorage.setItem(REMEMBER_EMAIL_KEY, email.trim());
      else localStorage.removeItem(REMEMBER_EMAIL_KEY);
    }
    await onSubmit(email, password);
  };

  const requestPasswordReset = async () => {
    setResetMessage(null);
    setResetLoading(true);
    const message = await onPasswordResetRequest(resetEmail || email);
    setResetMessage(message);
    setResetLoading(false);
  };

  if (recoveryMode) return (
    <main className="auth-desktop-frame" aria-label="Picom password recovery">
      <LoginBackgroundAnimation theme={theme} />
      <section className="auth-hero" aria-hidden="true"><div className="auth-logo-orb auth-logo-orb--brand"><img className="picom-brand-logo" src={brandLogoUrl} alt="" /></div><p className="eyebrow">Secure account recovery</p><h1>Choose a new password.</h1><p>Use a unique password you do not use elsewhere. Picom never displays, stores, or logs recovery codes.</p></section>
      <form className="auth-card" onSubmit={(event) => { event.preventDefault(); void (async () => { if (recoveryLoading) return; if (newPassword !== confirmNewPassword) { setRecoverySucceeded(false); setRecoveryResult("Passwords do not match."); return; } if (!onConfirmPasswordReset) return; setRecoveryLoading(true); const result = await onConfirmPasswordReset(newPassword); setRecoveryLoading(false); setRecoverySucceeded(result.ok); setRecoveryResult(result.message); if (result.ok) { setNewPassword(""); setConfirmNewPassword(""); } })(); }}>
        <div className="auth-card-header"><div><p className="eyebrow">Password recovery</p><h2>Set new password</h2></div></div>
        <p className="auth-note">{recoveryMessage ?? "Recovery link accepted. Enter a new password."}</p>
        <label className="auth-field"><span>New password</span><input type="password" autoComplete="new-password" minLength={12} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></label>
        <label className="auth-field"><span>Confirm new password</span><input type="password" autoComplete="new-password" minLength={12} value={confirmNewPassword} onChange={(event) => setConfirmNewPassword(event.target.value)} required /></label>
        <small className="auth-note">Use at least 12 characters. All existing sessions are signed out after a successful reset.</small>
        {recoveryResult || error ? <div className={recoverySucceeded ? "auth-success" : "auth-error"} role="status">{recoveryResult ?? error}</div> : null}
        <button className="auth-submit" type="submit" disabled={recoveryLoading || newPassword.length < 12 || newPassword !== confirmNewPassword}>{recoveryLoading ? "Updating password..." : "Update password"}<AppIcon name="lock" size="sm" /></button>
        <button className="auth-seed-button" type="button" disabled={recoveryLoading} onClick={onCancelPasswordRecovery}>Back to sign in</button>
      </form>
    </main>
  );

  return (
    <main className="auth-desktop-frame" aria-label="Picom sign in">
      <LoginBackgroundAnimation theme={theme} />
      <section className="auth-hero" aria-hidden="true">
        <div className="auth-logo-orb auth-logo-orb--brand">
          <img className="picom-brand-logo" src={brandLogoUrl} alt="" />
        </div>
        <p className="eyebrow">Desktop community chat <span className="picom-beta-badge">Beta · Frontend preview</span></p>
        <h1>Welcome back to Picom.</h1>
        <p>
          Sign in to continue into your Windows, Linux, or macOS desktop workspace. The MVP keeps the chat shell fast,
          focused, and backend-ready.
        </p>
        <div className="auth-feature-list">
          <span><AppIcon name="users" size="sm" /> Communities</span>
          <span><AppIcon name="hash" size="sm" /> Channels</span>
          <span><AppIcon name="image" size="sm" /> Attachments</span>
        </div>
      </section>

      <form className="auth-card" onSubmit={submit}>
        <div className="auth-card-header">
          <div>
            <p className="eyebrow">Secure sign in</p>
            <h2>Email and password</h2>
          </div>
        </div>

        <label className="auth-field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            required
          />
        </label>

        <label className="auth-field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            required
          />
        </label>

        {error ? <div className="auth-error" role="alert">{error}</div> : null}

        <div className="auth-options-row">
          <label className="auth-remember">
            <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
            <span>Remember me</span>
          </label>
          <button className="auth-secondary-link" type="button" onClick={() => setResetOpen((current) => !current)}>
            Forgot password?
          </button>
        </div>

        {resetOpen ? (
          <div className="password-reset-panel">
            <strong>Reset your password</strong>
            <p>Enter your email. Picom will show the same safe response whether an account exists or not.</p>
            <label className="auth-field">
              <span>Reset email</span>
              <input
                type="email"
                autoComplete="email"
                value={resetEmail}
                onChange={(event) => setResetEmail(event.target.value)}
                placeholder="you@company.com"
              />
            </label>
            {resetMessage ? <div className="auth-success" role="status">{resetMessage}</div> : null}
            <button className="auth-seed-button" type="button" disabled={resetLoading} onClick={requestPasswordReset}>
              {resetLoading ? "Sending..." : "Send reset email"}
            </button>
          </div>
        ) : null}

        <div className="auth-divider"><span>or continue with</span></div>
        <SocialLoginButtons disabled={loading} />

        <button className="auth-submit" type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
          <AppIcon name="send" size="sm" />
        </button>

        <button className="auth-secondary-link" type="button" onClick={onSwitchToRegister}>
          New to Picom? Create an account
        </button>

        {isMockMode ? (
          <>
            <button
              className="auth-seed-button"
              type="button"
              onClick={() => {
                setEmail(localSeed.email);
                setPassword(localSeed.password);
              }}
            >
              Use local seed account
            </button>

            <p className="auth-note">
              Local seed credentials are for development only. Password values are never logged by the auth wrapper.
            </p>
          </>
        ) : null}
      </form>
    </main>
  );
}
