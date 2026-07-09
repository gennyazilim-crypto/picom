import { useState } from "react";
import { socialAuthService, type SocialAuthProvider } from "../../services/auth/socialAuthService";
import { AppIcon } from "../AppIcon";

type Props = { disabled?: boolean };

export function SocialLoginButtons({ disabled = false }: Props) {
  const [activeProvider, setActiveProvider] = useState<SocialAuthProvider | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const google = socialAuthService.getProviderAvailability("google");
  const apple = socialAuthService.getProviderAvailability("apple");

  const begin = async (provider: SocialAuthProvider) => {
    setActiveProvider(provider);
    setMessage(null);
    const result = await socialAuthService.beginOAuth(provider);
    setMessage(result.ok ? "Continue in your browser. Picom will reopen after authorization." : result.error);
    setActiveProvider(null);
  };

  return (
    <section className="social-login" aria-label="Social sign in options">
      <div className="social-login-grid">
        <button type="button" disabled={disabled || !google.enabled || activeProvider !== null} onClick={() => void begin("google")} title={google.reason}>
          <AppIcon name="user" size="sm" />
          {activeProvider === "google" ? "Opening Google…" : "Continue with Google"}
        </button>
        <button type="button" disabled={disabled || !apple.enabled || activeProvider !== null} onClick={() => void begin("apple")} title={apple.reason}>
          <AppIcon name="user" size="sm" />
          {activeProvider === "apple" ? "Opening Apple…" : "Continue with Apple"}
        </button>
      </div>
      {message ? <p className="social-login-note" role="status">{message}</p> : null}
      {!google.enabled || !apple.enabled ? <p className="social-login-config">{google.reason ?? apple.reason}</p> : null}
      <div className="auth-divider"><span>or use email</span></div>
    </section>
  );
}
