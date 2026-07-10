import { useState, type FormEvent } from "react";
import logoUrl from "../../assets/brand/picom-logo-concept.png";
import { AppIcon } from "./AppIcon";
import { ThemeToggle } from "./ThemeToggle";
import { SocialLoginButtons } from "./auth/SocialLoginButtons";
import { LegalDocumentModal } from "./legal/LegalDocumentModal";
import type { LegalDocumentId } from "../data/legalDocuments";
import { legalConfig } from "../config/legalConfig";

type RegisterScreenProps = {
  theme: "light" | "dark";
  loading: boolean;
  error: string | null;
  onToggleTheme: () => void;
  onSubmit: (email: string, password: string, displayName: string, acceptedLegalVersion: string) => Promise<void>;
  onSwitchToLogin: () => void;
};

export function RegisterScreen({ theme, loading, error, onToggleTheme, onSubmit, onSwitchToLogin }: RegisterScreenProps) {
  const [displayName, setDisplayName] = useState("Picom User");
  const [email, setEmail] = useState("new@picom.local");
  const [password, setPassword] = useState("PicomDev123!");
  const [confirmPassword, setConfirmPassword] = useState("PicomDev123!");
  const [localError, setLocalError] = useState<string | null>(null);
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [openLegalDocument, setOpenLegalDocument] = useState<LegalDocumentId | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError(null);

    if (!acceptedLegal) {
      setLocalError("Accept the Terms of Service and Privacy Policy to create an account.");
      return;
    }

    if (password !== confirmPassword) {
      setLocalError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setLocalError("Password must be at least 8 characters.");
      return;
    }

    await onSubmit(email, password, displayName, legalConfig.currentVersion);
  };

  return (
    <main className="auth-desktop-frame" aria-label="Create Picom account">
      <section className="auth-hero" aria-hidden="true">
        <div className="auth-logo-orb">
          <img src={logoUrl} alt="" />
        </div>
        <p className="eyebrow">Create workspace access</p>
        <h1>Start your Picom desktop account.</h1>
        <p>
          Register with email and password for the Supabase-backed MVP. The desktop shell stays compact, polished,
          and ready for communities, channels, and realtime chat.
        </p>
        <div className="auth-feature-list">
          <span><AppIcon name="user" size="sm" /> Profile</span>
          <span><AppIcon name="lock" size="sm" /> RLS-ready</span>
          <span><AppIcon name="bell" size="sm" /> Notifications later</span>
        </div>
      </section>

      <form className="auth-card" onSubmit={submit}>
        <div className="auth-card-header">
          <div>
            <p className="eyebrow">New account</p>
            <h2>Register</h2>
          </div>
          <ThemeToggle theme={theme} onToggleTheme={onToggleTheme} compact />
        </div>

        <SocialLoginButtons disabled={loading || !acceptedLegal} />

        <label className="auth-field">
          <span>Display name</span>
          <input
            type="text"
            autoComplete="name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Your display name"
            required
          />
        </label>

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
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Create a password"
            required
          />
        </label>

        <label className="auth-field">
          <span>Confirm password</span>
          <input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Confirm your password"
            required
          />
        </label>

        <label className="legal-acceptance-row">
          <input type="checkbox" checked={acceptedLegal} onChange={(event) => setAcceptedLegal(event.target.checked)} required />
          <span>I agree to the <button type="button" onClick={() => setOpenLegalDocument("terms")}>Terms of Service</button> and <button type="button" onClick={() => setOpenLegalDocument("privacy")}>Privacy Policy</button>.</span>
        </label>
        <p className="auth-note">Acceptance version {legalConfig.currentVersion} and its server timestamp are recorded with your profile.</p>

        {localError || error ? <div className="auth-error" role="alert">{localError ?? error}</div> : null}

        <button className="auth-submit" type="submit" disabled={loading || !acceptedLegal}>
          {loading ? "Creating account..." : "Create account"}
          <AppIcon name="send" size="sm" />
        </button>

        <button className="auth-secondary-link" type="button" onClick={onSwitchToLogin}>
          Already have an account? Sign in
        </button>

        <p className="auth-note">
          Registration uses the centralized auth wrapper. Passwords are passed to Supabase Auth only and are not logged.
        </p>
      </form>
      {openLegalDocument ? <LegalDocumentModal documentId={openLegalDocument} onClose={() => setOpenLegalDocument(null)} /> : null}
    </main>
  );
}
