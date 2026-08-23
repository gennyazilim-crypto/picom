import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion, type Variants } from "../../utils/motionLite";
import {
  getSocialAuthProviderLabel,
  isCustomOAuthProvider,
  socialAuthService,
  type SocialAuthProvider,
} from "../../services/auth/socialAuthService";
import { finishAuthAttempt, subscribeAuthAttempt, type AuthAttempt } from "../../services/auth/authAttemptStore";
import { SocialProviderLogo } from "./SocialProviderLogo";
import { useTranslation } from "../../i18n";
import { authErrorI18nKey } from "../../services/auth/authErrorMap";
import { externalLinkService } from "../../services/desktop/externalLinkService";
import { dataSourceService } from "../../services/dataSourceService";

type Props = Readonly<{
  disabled?: boolean;
  layout?: "stacked" | "icons";
}>;

const LOGIN_PROVIDERS: readonly SocialAuthProvider[] = ["google", "epic", "steam"];
const LOGO_SIZE = 20;

const gridVariants: Variants = {
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const buttonVariants: Variants = {
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
  },
};

function connectingCopy(provider: SocialAuthProvider, t: (key: string, params?: Record<string, string>) => string): string {
  if (provider === "google") return t("social.connectingGoogle");
  if (provider === "epic") return t("social.connectingEpic");
  if (provider === "steam") return t("social.connectingSteam");
  return t("social.connecting", { provider: getSocialAuthProviderLabel(provider) });
}

export function SocialLoginButtons({ disabled = false, layout = "icons" }: Props) {
  const { t } = useTranslation("auth");
  const reduceMotion = useReducedMotion();
  const [attempt, setAttempt] = useState<AuthAttempt | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"info" | "error">("info");
  const supabaseReady = dataSourceService.getStatus().isSupabase && dataSourceService.getStatus().configured;

  useEffect(() => subscribeAuthAttempt(setAttempt), []);

  const providers = useMemo(() => {
    return LOGIN_PROVIDERS.map((provider) => {
      const availability = socialAuthService.getProviderAvailability(provider);
      return {
        provider,
        label: getSocialAuthProviderLabel(provider),
        enabled: supabaseReady && availability.enabled,
      };
    });
  }, [supabaseReady]);

  const busy = attempt !== null;

  const begin = async (provider: SocialAuthProvider) => {
    if (busy || disabled) return;
    setMessage(null);
    const hasNativeOpener = Boolean(window.picomDesktop?.externalLinks?.openUrl);
    const preparedWindow = hasNativeOpener ? null : externalLinkService.prepareExternalWindow();
    const result = isCustomOAuthProvider(provider)
      ? await socialAuthService.beginCustomOAuth(provider, preparedWindow)
      : await socialAuthService.beginOAuth(provider, preparedWindow);
    if (result.ok) {
      setMessageTone("info");
      setMessage(connectingCopy(provider, t));
      return;
    }
    setMessageTone("error");
    setMessage(t(authErrorI18nKey(result.code)));
  };

  const cancel = () => {
    if (!attempt) return;
    finishAuthAttempt(attempt.provider);
    setMessageTone("info");
    setMessage(t("error.AUTH_CANCELLED"));
  };

  const stacked = layout === "stacked";

  return (
    <>
      <div className="auth-divider">
        <span>{t("social.divider")}</span>
      </div>
      <section className={`social-login${stacked ? " social-login--stacked" : ""}`} aria-label={t("social.optionsAria")}>
        <motion.div
          className={stacked ? "social-login-stack-list" : "social-login-grid"}
          variants={reduceMotion ? undefined : gridVariants}
          initial={false}
          animate={reduceMotion ? undefined : "visible"}
        >
          {providers.map(({ provider, label, enabled }) => {
            const isActive = attempt?.provider === provider;
            const isDisabled = disabled || !enabled || busy;

            return (
              <motion.button
                key={provider}
                type="button"
                className={`social-login-provider social-login-provider--${provider}${stacked ? " social-login-provider--chip" : ""}${isActive ? " is-active" : ""}${enabled ? "" : " is-pending"}`}
                disabled={isDisabled}
                onClick={() => void begin(provider)}
                title={enabled ? t("social.continueWith", { provider: label }) : t("social.providerUnavailable", { provider: label })}
                aria-label={isActive ? connectingCopy(provider, t) : enabled ? t("social.continueWith", { provider: label }) : t("social.providerUnavailable", { provider: label })}
                aria-busy={isActive}
                variants={reduceMotion ? undefined : buttonVariants}
                whileHover={reduceMotion || isDisabled ? undefined : { y: -1, scale: 1.01 }}
                whileTap={reduceMotion || isDisabled ? undefined : { scale: 0.98 }}
                layout={!reduceMotion}
              >
                <span className="social-login-provider-mark" aria-hidden="true">
                  {isActive ? <span className="social-login-spinner" /> : <SocialProviderLogo provider={provider} size={LOGO_SIZE} />}
                </span>
                {stacked ? (
                  <span className="social-login-provider-copy">
                    <strong>{label}</strong>
                    {isActive ? <small>{connectingCopy(provider, t)}</small> : null}
                  </span>
                ) : null}
              </motion.button>
            );
          })}
        </motion.div>
        {busy ? (
          <button type="button" className="auth-text-link" onClick={cancel}>
            {t("social.cancel")}
          </button>
        ) : null}
        {message ? (
          <p className={`social-login-note${messageTone === "error" ? " is-error" : ""}`} role={messageTone === "error" ? "alert" : "status"}>
            {message}
          </p>
        ) : null}
      </section>
    </>
  );
}
