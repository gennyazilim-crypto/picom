import {
  getAccountLoginUrl,
  getEmailChangeUrl,
  getEmailConfirmationUrl,
  getPasswordResetUrl,
} from "../config/accountCenterUrls";

const DEFAULT_ACCOUNT_ORIGIN = "https://account.picom.gg";
const DEFAULT_SUPPORT_ORIGIN = "https://support.picom.gg";
const DEFAULT_APP_ORIGIN = "https://app.picom.gg";

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function resolveOrigin(envName: "VITE_ACCOUNT_ORIGIN" | "VITE_SUPPORT_ORIGIN", fallback: string, allowWindowFallback: boolean): string {
  const fromEnv = (import.meta.env[envName] ?? (envName === "VITE_ACCOUNT_ORIGIN" ? import.meta.env.VITE_APP_URL : "") ?? "").trim();
  if (fromEnv) {
    try {
      return trimTrailingSlash(new URL(fromEnv).origin);
    } catch {
      // Fall through.
    }
  }
  if (allowWindowFallback && typeof window !== "undefined" && window.location?.origin) {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return trimTrailingSlash(window.location.origin);
    }
  }
  return fallback;
}

export const ACCOUNT_ORIGIN = resolveOrigin("VITE_ACCOUNT_ORIGIN", DEFAULT_ACCOUNT_ORIGIN, true);
export const SUPPORT_ORIGIN = resolveOrigin("VITE_SUPPORT_ORIGIN", DEFAULT_SUPPORT_ORIGIN, false);

function resolveAppOrigin(): string {
  const fromEnv = (import.meta.env.VITE_WEB_APP_URL ?? import.meta.env.VITE_APP_HOME_URL ?? "").trim();
  if (fromEnv) {
    try {
      return trimTrailingSlash(new URL(fromEnv).origin);
    } catch {
      // Fall through.
    }
  }
  return DEFAULT_APP_ORIGIN;
}

export const APP_ORIGIN = resolveAppOrigin();
export const APP_HOME_URL = APP_ORIGIN;

export const ACCOUNT_AUTH = {
  callbackUrl: `${ACCOUNT_ORIGIN}/auth/callback`,
  loginUrl: getAccountLoginUrl(),
  resetPasswordUrl: getPasswordResetUrl(),
  verifyEmailUrl: getEmailConfirmationUrl(),
  changeEmailUrl: getEmailChangeUrl(),
  emailRedirectTo: getEmailConfirmationUrl(),
} as const;

export const ACCOUNT_SUPPORT_EMAIL = "support@picom.gg";
export const ACCOUNT_PRIVACY_EMAIL = "privacy@picom.gg";
export const SUPPORT_HOME_URL = `${SUPPORT_ORIGIN}/?source=account`;

export const LEGAL_POLICY_VERSION = {
  terms: "2026-07-01",
  privacy: "2026-07-01",
  cookies: "2026-07-01",
} as const;
