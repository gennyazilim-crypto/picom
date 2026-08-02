import { useMemo, useState } from "react";
import { motion, useReducedMotion, type Variants } from "../../utils/motionLite";
import {
  getSocialAuthProviderLabel,
  isCustomOAuthProvider,
  socialAuthService,
  type SocialAuthProvider,
} from "../../services/auth/socialAuthService";
import { SocialProviderLogo } from "./SocialProviderLogo";
import { externalLinkService } from "../../services/desktop/externalLinkService";
import { dataSourceService } from "../../services/dataSourceService";

type Props = Readonly<{
  disabled?: boolean;
  /** stacked = labeled rows; icons = compact circle grid */
  layout?: "stacked" | "icons";
}>;

/** Google appears when its OAuth flag is enabled; Steam/Epic remain always listed. */
const ALWAYS_VISIBLE_PROVIDERS: readonly SocialAuthProvider[] = ["steam", "epic"];
const OPTIONAL_PROVIDERS: readonly SocialAuthProvider[] = ["google"];
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

export function SocialLoginButtons({ disabled = false, layout = "icons" }: Props) {
  const reduceMotion = useReducedMotion();
  const [activeProvider, setActiveProvider] = useState<SocialAuthProvider | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const supabaseReady = dataSourceService.getStatus().isSupabase && dataSourceService.getStatus().configured;

  const providers = useMemo(() => {
    const visible = [
      ...OPTIONAL_PROVIDERS.filter((provider) => socialAuthService.getProviderAvailability(provider).enabled),
      ...ALWAYS_VISIBLE_PROVIDERS,
    ];

    if (!supabaseReady) {
      return socialAuthService
        .getAvailableProviders()
        .filter((provider) => visible.includes(provider))
        .map((provider) => {
          const availability = socialAuthService.getProviderAvailability(provider);
          return {
            provider,
            label: getSocialAuthProviderLabel(provider),
            enabled: availability.enabled,
          };
        });
    }

    return visible.map((provider) => {
      const availability = socialAuthService.getProviderAvailability(provider);
      return {
        provider,
        label: getSocialAuthProviderLabel(provider),
        enabled: availability.enabled,
      };
    });
  }, [supabaseReady]);

  const begin = async (provider: SocialAuthProvider, enabled: boolean) => {
    if (!enabled) {
      setMessage(`${getSocialAuthProviderLabel(provider)} sign-in is coming soon.`);
      return;
    }
    setActiveProvider(provider);
    setMessage(null);
    const hasNativeOpener = Boolean(window.picomDesktop?.externalLinks?.openUrl);
    const preparedWindow = hasNativeOpener ? null : externalLinkService.prepareExternalWindow();
    const result = isCustomOAuthProvider(provider)
      ? await socialAuthService.beginCustomOAuth(provider, preparedWindow)
      : await socialAuthService.beginOAuth(provider, preparedWindow);
    setMessage(result.ok ? "Continue in your browser. Picom will reopen after authorization." : result.error);
    setActiveProvider(null);
  };

  if (providers.length === 0) return null;

  const stacked = layout === "stacked";

  return (
    <>
      <div className="auth-divider">
        <span>or continue with</span>
      </div>
      <section className={`social-login${stacked ? " social-login--stacked" : ""}`} aria-label="Social sign in options">
        <motion.div
          className={stacked ? "social-login-pair" : "social-login-grid"}
          variants={reduceMotion ? undefined : gridVariants}
          initial={false}
          animate={reduceMotion ? undefined : "visible"}
        >
          {providers.map(({ provider, label, enabled }) => {
            const isActive = activeProvider === provider;
            const isDisabled = disabled || activeProvider !== null;

            return (
              <motion.button
                key={provider}
                type="button"
                className={`social-login-provider social-login-provider--${provider}${stacked ? " social-login-provider--chip" : ""}${isActive ? " is-active" : ""}${enabled ? "" : " is-pending"}`}
                disabled={isDisabled}
                onClick={() => void begin(provider, enabled)}
                title={enabled ? `Continue with ${label}` : `${label} coming soon`}
                aria-label={isActive ? `Opening ${label}` : enabled ? `Continue with ${label}` : `${label} coming soon`}
                variants={reduceMotion ? undefined : buttonVariants}
                whileHover={reduceMotion || isDisabled ? undefined : { y: -1, scale: 1.02 }}
                whileTap={reduceMotion || isDisabled ? undefined : { scale: 0.98 }}
                layout={!reduceMotion}
              >
                <span className="social-login-provider-mark" aria-hidden="true">
                  <SocialProviderLogo provider={provider} size={LOGO_SIZE} />
                </span>
                {stacked ? (
                  <span className="social-login-provider-copy">
                    <strong>{label}</strong>
                    <small>{enabled ? "Continue" : "Coming soon"}</small>
                  </span>
                ) : null}
              </motion.button>
            );
          })}
        </motion.div>
        {message ? (
          <p className="social-login-note" role="status">
            {message}
          </p>
        ) : null}
      </section>
    </>
  );
}
