/**
 * Allowlisted HTTPS hosts for PICOM Verified checkout / portal / Account Center opens.
 * Desktop must validate before opening an external browser URL through the preload bridge.
 */

const ACCOUNT_HOSTS = new Set([
  "account.picom.gg",
  "app.picom.gg",
  "picom.gg",
  "www.picom.gg",
  "auth.picom.gg",
  "support.picom.gg",
]);

function isStripeBillingHost(host: string): boolean {
  return (
    host === "checkout.stripe.com"
    || host === "billing.stripe.com"
    || host === "verify.stripe.com"
    || host.endsWith(".stripe.com")
  );
}

function isIyzicoBillingHost(host: string): boolean {
  return host === "iyzi.link" || host.endsWith(".iyzi.link") || host === "iyzilink.com" || host.endsWith(".iyzilink.com");
}

export function isAllowedVerifiedExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "https:") return false;
    if (parsed.username || parsed.password) return false;
    const host = parsed.hostname.toLowerCase();
    if (ACCOUNT_HOSTS.has(host)) return true;
    return isStripeBillingHost(host) || isIyzicoBillingHost(host);
  } catch {
    return false;
  }
}
