import { useState, type FormEvent } from "react";
import logoUrl from "../../assets/brand/picom-logo-concept.png";
import { AppIcon } from "./AppIcon";
import { ThemeToggle } from "./ThemeToggle";
import { SocialLoginButtons } from "./auth/SocialLoginButtons";
import { LoginBackgroundAnimation } from "./auth/LoginBackgroundAnimation";

type LoginScreenProps = {
  theme: "light" | "dark";
  loading: boolean;
  error: string | null;
  onToggleTheme: () => void;
  onSubmit: (email: string, password: string) => Promise<void>;
  onPasswordResetRequest: (email: string) => Promise<string>;
  onSwitchToRegister: () => void;
};

const localSeed = {
  email: "owner@picom.local",
  password: "PicomDev123!",
};

export function LoginScreen({ theme, loading, error, onToggleTheme, onSubmit, onPasswordResetRequest, onSwitchToRegister }: LoginScreenProps) {
  const [email, setEmail] = useState(localSeed.email);
  const [password, setPassword] = useState(localSeed.password);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState(localSeed.email);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit(email, password);
  };

  const requestPasswordReset = async () => {
    setResetMessage(null);
    setResetLoading(true);
    const message = await onPasswordResetRequest(resetEmail || email);
    setResetMessage(message);
    setResetLoading(false);
  };

  return (
    <main className="auth-desktop-frame" aria-label="Picom sign in">
      <LoginBackgroundAnimation theme={theme} />
      <section className="auth-hero" aria-hidden="true">
        <div className="auth-logo-orb">
          <img src={logoUrl} alt="" />
        </div>
        <p className="eyebrow">Desktop community chat</p>
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
          <ThemeToggle theme={theme} onToggleTheme={onToggleTheme} compact />
        </div>

        <SocialLoginButtons disabled={loading} />

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

        <button className="auth-secondary-link" type="button" onClick={() => setResetOpen((current) => !current)}>
          Forgot password?
        </button>

        {resetOpen ? (
          <div className="password-reset-panel">
            <strong>Password reset placeholder</strong>
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
              {resetLoading ? "Preparing..." : "Request reset placeholder"}
            </button>
          </div>
        ) : null}

        <button className="auth-submit" type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
          <AppIcon name="send" size="sm" />
        </button>

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
      </form>
    </main>
  );
}
