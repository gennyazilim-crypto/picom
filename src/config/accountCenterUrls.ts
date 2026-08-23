/**
 * Canonical Web Account Center and related public origins.
 * Desktop must open these in the system browser through the validated external-navigation bridge,
 * never inside an Electron WebView.
 */

const ACCOUNT_ORIGIN = "https://account.picom.gg";
const MARKETING_ORIGIN = "https://picom.gg";
const SUPPORT_ORIGIN = "https://support.picom.gg";
const APP_ORIGIN = "https://app.picom.gg";
const AUTH_PATHS = Object.freeze({
  login: "/login",
  resetPassword: "/reset-password",
  resetPasswordLegacy: "/auth/reset-password",
  confirmEmail: "/verify-email",
  confirmEmailLegacy: "/auth/confirm",
  changeEmail: "/email-change",
  changeEmailLegacy: "/auth/change-email",
  security: "/security",
  connections: "/connections",
} as const);

export const ACCOUNT_CENTER_ALLOWED_ORIGINS = Object.freeze([
  ACCOUNT_ORIGIN,
  MARKETING_ORIGIN,
  SUPPORT_ORIGIN,
  APP_ORIGIN,
  "https://auth.picom.gg",
] as const);

function withSource(path: string, source: "desktop" | "web" = "desktop", nonce?: string): string {
  const url = new URL(path, ACCOUNT_ORIGIN);
  url.searchParams.set("source", source);
  if (nonce) url.searchParams.set("nonce", nonce);
  return url.toString();
}

function withAuthParams(
  path: string,
  params: Readonly<{ code?: string; tokenHash?: string; authType?: string; error?: string }>,
): string {
  const url = new URL(path, ACCOUNT_ORIGIN);
  url.searchParams.set("source", "desktop");
  if (params.tokenHash) {
    url.searchParams.set("token_hash", params.tokenHash);
    if (params.authType) url.searchParams.set("type", params.authType);
  } else if (params.code) {
    url.searchParams.set("code", params.code);
  }
  if (params.error) url.searchParams.set("error", params.error);
  return url.toString();
}

export const accountCenterUrls = Object.freeze({
  origin: ACCOUNT_ORIGIN,
  marketingOrigin: MARKETING_ORIGIN,
  supportOrigin: SUPPORT_ORIGIN,
  appOrigin: APP_ORIGIN,
  register: withSource("/register"),
  registerWithNonce: (nonce: string, source: "desktop" | "web" = "desktop") => withSource("/register", source, nonce),
  forgotPassword: withSource("/forgot-password"),
  manageAccount: withSource("/account/overview"),
  profile: withSource("/account/profile"),
  password: withSource("/account/password"),
  email: withSource("/account/email"),
  sessions: withSource("/account/sessions"),
  dataExport: withSource("/account/data"),
  deleteAccount: withSource("/account/delete"),
  verified: withSource("/verified"),
  verifiedStatus: withSource("/verified/status"),
  billing: withSource("/account/billing"),
  accountVerification: withSource("/account/verification"),
  businessApply: withSource("/business/apply"),
  businessDashboard: withSource("/business/dashboard"),
  creatorMonetization: withSource("/creator/monetization"),
  publisherMonetization: withSource("/publisher/monetization"),
  adsTransparency: withSource("/ads/transparency"),
  connections: withSource(AUTH_PATHS.connections),
  login: `${ACCOUNT_ORIGIN}${AUTH_PATHS.login}`,
  resetPassword: `${ACCOUNT_ORIGIN}${AUTH_PATHS.resetPassword}`,
  resetPasswordWithAuth: (params: Readonly<{ code?: string; tokenHash?: string; authType?: string; error?: string }>) =>
    withAuthParams(AUTH_PATHS.resetPasswordLegacy, params),
  confirmEmail: `${ACCOUNT_ORIGIN}${AUTH_PATHS.confirmEmail}`,
  confirmEmailWithAuth: (params: Readonly<{ code?: string; tokenHash?: string; authType?: string; error?: string }>) =>
    withAuthParams(AUTH_PATHS.confirmEmailLegacy, params),
  changeEmail: `${ACCOUNT_ORIGIN}${AUTH_PATHS.changeEmail}`,
  changeEmailWithAuth: (params: Readonly<{ code?: string; tokenHash?: string; authType?: string; error?: string }>) =>
    withAuthParams(AUTH_PATHS.changeEmailLegacy, params),
  security: `${ACCOUNT_ORIGIN}${AUTH_PATHS.security}`,
  authCallback: `${ACCOUNT_ORIGIN}/auth/callback`,
  privacy: `${MARKETING_ORIGIN}/privacy`,
  terms: `${MARKETING_ORIGIN}/terms`,
  licenses: `${MARKETING_ORIGIN}/legal/licenses`,
  support: `${SUPPORT_ORIGIN}/?source=desktop`,
  supportHome: `${SUPPORT_ORIGIN}/?source=desktop`,
});

export function getPasswordResetUrl(): string {
  return accountCenterUrls.resetPassword;
}

export function getEmailConfirmationUrl(): string {
  return accountCenterUrls.confirmEmail;
}

export function getEmailChangeUrl(): string {
  return accountCenterUrls.changeEmail;
}

export function getAccountLoginUrl(): string {
  return accountCenterUrls.login;
}

/** HTTPS-only Picom property allowlist for desktop external opens. */
export function isAllowedAccountCenterUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "https:") return false;
    if (parsed.username || parsed.password) return false;
    const host = parsed.hostname.toLowerCase();
    return (
      host === "picom.gg"
      || host === "www.picom.gg"
      || host === "account.picom.gg"
      || host === "auth.picom.gg"
      || host === "support.picom.gg"
      || host === "app.picom.gg"
    );
  } catch {
    return false;
  }
}
