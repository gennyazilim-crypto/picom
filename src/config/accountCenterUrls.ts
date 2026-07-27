/**
 * Canonical Web Account Center and related public origins.
 * Desktop must open these in the system browser (shell.openExternal via allowlist),
 * never inside an Electron WebView.
 */

const ACCOUNT_ORIGIN = "https://account.picom.gg";
const MARKETING_ORIGIN = "https://picom.gg";
const SUPPORT_ORIGIN = "https://support.picom.gg";
const APP_ORIGIN = "https://app.picom.gg";

export const ACCOUNT_CENTER_ALLOWED_ORIGINS = Object.freeze([
  ACCOUNT_ORIGIN,
  MARKETING_ORIGIN,
  SUPPORT_ORIGIN,
  APP_ORIGIN,
] as const);

function withSource(path: string, source: "desktop" | "web" = "desktop", nonce?: string): string {
  const url = new URL(path, ACCOUNT_ORIGIN);
  url.searchParams.set("source", source);
  if (nonce) url.searchParams.set("nonce", nonce);
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
  resetPassword: `${ACCOUNT_ORIGIN}/reset-password`,
  authCallback: `${ACCOUNT_ORIGIN}/auth/callback`,
  privacy: `${MARKETING_ORIGIN}/legal/privacy`,
  terms: `${MARKETING_ORIGIN}/legal/terms`,
  support: `${SUPPORT_ORIGIN}/?source=desktop`,
  supportHome: `${SUPPORT_ORIGIN}/?source=desktop`,
});

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
      || host === "support.picom.gg"
      || host === "app.picom.gg"
    );
  } catch {
    return false;
  }
}
