import { useMemo, useState } from "react";
import { motion, useReducedMotion, type Variants } from "../../utils/motionLite";
import {
  getSocialAuthProviderLabel,
  isCustomOAuthProvider,
  SOCIAL_AUTH_PROVIDER_ORDER,
  socialAuthService,
  type SocialAuthProvider,
} from "../../services/auth/socialAuthService";
import { SocialProviderLogo } from "./SocialProviderLogo";
import { externalLinkService } from "../../services/desktop/externalLinkService";

type Props = { disabled?: boolean };

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

export function SocialLoginButtons({ disabled = false }: Props) {
  const reduceMotion = useReducedMotion();
  const [activeProvider, setActiveProvider] = useState<SocialAuthProvider | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const providers = useMemo(
    () => SOCIAL_AUTH_PROVIDER_ORDER.map((provider) => ({
      provider,
      label: getSocialAuthProviderLabel(provider),
      availability: socialAuthService.getProviderAvailability(provider),
    })),
    [],
  );
  const configMessage = providers.find((entry) => !entry.availability.enabled)?.availability.reason;

  const begin = async (provider: SocialAuthProvider) => {
    setActiveProvider(provider);
    setMessage(null);
    // Pre-open the popup synchronously within the click gesture so the browser popup
    // blocker allows it; the desktop app ignores this and uses its native opener.
    const hasNativeOpener = Boolean(window.picomDesktop?.externalLinks?.openUrl);
    const preparedWindow = hasNativeOpener ? null : externalLinkService.prepareExternalWindow();
    const result = isCustomOAuthProvider(provider)
      ? await socialAuthService.beginCustomOAuth(provider, preparedWindow)
      : await socialAuthService.beginOAuth(provider, preparedWindow);
    setMessage(result.ok ? "Continue in your browser. Picom will reopen after authorization." : result.error);
    setActiveProvider(null);
  };

  return (
    <section className="social-login" aria-label="Social sign in options">
      <motion.div
        className="social-login-grid"
        variants={reduceMotion ? undefined : gridVariants}
        initial={false}
        animate={reduceMotion ? undefined : "visible"}
      >
        {providers.map(({ provider, label, availability }) => {
          const isActive = activeProvider === provider;
          const isDisabled = disabled || !availability.enabled || activeProvider !== null;

          return (
            <motion.button
              key={provider}
              type="button"
              className={`social-login-provider social-login-provider--${provider}${isActive ? " is-active" : ""}`}
              disabled={isDisabled}
              onClick={() => void begin(provider)}
              title={availability.reason ?? label}
              aria-label={isActive ? `Opening ${label}` : `Continue with ${label}`}
              variants={reduceMotion ? undefined : buttonVariants}
              whileHover={reduceMotion || isDisabled ? undefined : { y: -1, scale: 1.04 }}
              whileTap={reduceMotion || isDisabled ? undefined : { scale: 0.96 }}
              layout={!reduceMotion}
            >
              <span className="social-login-provider-mark" aria-hidden="true">
                <SocialProviderLogo provider={provider} size={LOGO_SIZE} />
              </span>
            </motion.button>
          );
        })}
      </motion.div>
      {message ? <p className="social-login-note" role="status">{message}</p> : null}
      {configMessage ? <p className="social-login-config">{configMessage}</p> : null}
    </section>
  );
}
