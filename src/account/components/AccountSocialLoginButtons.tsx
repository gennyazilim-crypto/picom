import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SocialProviderLogo } from "../../components/auth/SocialProviderLogo";
import { appConfig } from "../../config/appConfig";
import {
  getSocialAuthProviderLabel,
  type SocialAuthProvider,
} from "../../services/auth/socialAuthService";
import { externalLinkService } from "../../services/desktop/externalLinkService";
import { t } from "../i18n/messages";
import { resolvePostLoginDestination } from "../lib/postLogin";
import { getAccountSupabase } from "../lib/supabase";
import { ROUTES } from "../routes";

const PROVIDERS: readonly SocialAuthProvider[] = ["google", "steam", "epic"];

type SocialAuthPollPayload = {
  status?: string;
  session?: { access_token?: string; refresh_token?: string } | null;
};

function generateNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function isProviderEnabled(provider: SocialAuthProvider): boolean {
  if (provider === "google") return appConfig.supabase.googleOAuthEnabled;
  if (provider === "steam") return appConfig.supabase.steamOAuthEnabled;
  if (provider === "epic") return appConfig.supabase.epicOAuthEnabled;
  return false;
}

export function AccountSocialLoginButtons({ disabled = false }: { disabled?: boolean }) {
  const navigate = useNavigate();
  const [activeProvider, setActiveProvider] = useState<SocialAuthProvider | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const begin = async (provider: SocialAuthProvider, enabled: boolean) => {
    if (!enabled) {
      setMessage(t("login.social.comingSoon").replace("{provider}", getSocialAuthProviderLabel(provider)));
      return;
    }

    setActiveProvider(provider);
    setMessage(null);

    if (provider === "google") {
      const supabase = getAccountSupabase();
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error || !data.url) {
        setMessage(t("login.social.failed").replace("{provider}", getSocialAuthProviderLabel(provider)));
        setActiveProvider(null);
        return;
      }
      const opened = await externalLinkService.openExternalUrl(data.url);
      setActiveProvider(null);
      if (!opened.ok) {
        setMessage(t("login.social.popupBlocked"));
        return;
      }
      setMessage(t("login.social.continueInBrowser"));
      return;
    }

    const base = appConfig.supabase.url.replace(/\/+$/, "");
    const anonKey = appConfig.supabase.anonKey;
    if (!base || !anonKey) {
      setMessage(t("login.social.unavailable"));
      setActiveProvider(null);
      return;
    }

    const nonce = generateNonce();
    const functionUrl = `${base}/functions/v1/${provider}-auth`;
    const brandedApi = appConfig.authGatewayUrl.replace(/\/+$/, "");
    const loginUrl = `${brandedApi}/${provider}/start?nonce=${encodeURIComponent(nonce)}`;
    if (/supabase\.(co|in)/i.test(loginUrl)) {
      setMessage(t("login.social.unavailable"));
      setActiveProvider(null);
      return;
    }
    const opened = await externalLinkService.openExternalUrl(loginUrl);

    if (!opened.ok) {
      setMessage(t("login.social.popupBlocked"));
      setActiveProvider(null);
      return;
    }

    setMessage(t("login.social.continueInBrowser"));

    const supabase = getAccountSupabase();
    const deadline = Date.now() + 150_000;

    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      let payload: SocialAuthPollPayload | null = null;
      try {
        const response = await fetch(`${functionUrl}?action=poll&nonce=${encodeURIComponent(nonce)}`, {
          headers: { apikey: anonKey },
        });
        payload = (await response.json()) as SocialAuthPollPayload;
      } catch {
        payload = null;
      }

      if (!payload) continue;

      if (payload.status === "ready" && payload.session?.access_token && payload.session.refresh_token) {
        const { data, error } = await supabase.auth.setSession({
          access_token: payload.session.access_token,
          refresh_token: payload.session.refresh_token,
        });
        setActiveProvider(null);
        if (error || !data.session) {
          setMessage(t("login.social.failed").replace("{provider}", getSocialAuthProviderLabel(provider)));
          return;
        }
        const destination = await resolvePostLoginDestination(data.session, null);
        navigate(destination.path, { replace: true });
        return;
      }

      if (payload.status === "expired" || payload.status === "consumed") break;
    }

    setActiveProvider(null);
    setMessage(t("login.social.timedOut").replace("{provider}", getSocialAuthProviderLabel(provider)));
  };

  return (
    <section className="ac-social-login" aria-label={t("login.social.aria")}>
      <div className="ac-auth-card-divider" role="separator" aria-hidden="true">
        <span>{t("login.social.continueWith")}</span>
      </div>
      <div className="ac-social-login__grid">
        {PROVIDERS.map((provider) => {
          const enabled = isProviderEnabled(provider);
          const label = getSocialAuthProviderLabel(provider);
          const isActive = activeProvider === provider;
          const isDisabled = disabled || activeProvider !== null;

          return (
            <button
              key={provider}
              type="button"
              className={`ac-social-login__btn ac-social-login__btn--${provider}${enabled ? "" : " is-pending"}${isActive ? " is-active" : ""}`}
              disabled={isDisabled}
              onClick={() => void begin(provider, enabled)}
              title={enabled ? t("login.social.continueTitle").replace("{provider}", label) : t("login.social.comingSoon").replace("{provider}", label)}
              aria-label={
                isActive
                  ? t("login.social.opening").replace("{provider}", label)
                  : enabled
                    ? t("login.social.continueTitle").replace("{provider}", label)
                    : t("login.social.comingSoon").replace("{provider}", label)
              }
            >
              <span className="ac-social-login__mark" aria-hidden="true">
                <SocialProviderLogo provider={provider} size={20} />
              </span>
              <span className="ac-social-login__copy">
                <strong>{label}</strong>
                <small>{enabled ? t("login.social.continue") : t("login.social.soon")}</small>
              </span>
            </button>
          );
        })}
      </div>
      {message ? (
        <p className="ac-social-login__note" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
