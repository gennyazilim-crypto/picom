const ACCOUNT_ORIGIN = Deno.env.get("PICOM_ACCOUNT_CENTER_URL")?.trim() || "https://account.picom.gg";
const APP_ORIGIN = Deno.env.get("PICOM_APP_URL")?.trim() || "https://app.picom.gg";

const ALLOWED_ORIGINS = new Set([
  ACCOUNT_ORIGIN.replace(/\/$/, ""),
  APP_ORIGIN.replace(/\/$/, ""),
  "https://account.picom.gg",
  "https://app.picom.gg",
  "https://picom.gg",
]);

const ALLOWED_RETURN_PATHS = new Set([
  "/verified",
  "/verified/status",
  "/verified/checkout",
  "/account/billing",
  "/account/verification",
  "/account/overview",
]);

export function isAllowedReturnPath(path: string): boolean {
  if (typeof path !== "string") return false;
  const trimmed = path.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("://")) return false;
  const normalized = trimmed.split("?")[0]?.split("#")[0] ?? "";
  return ALLOWED_RETURN_PATHS.has(normalized);
}

export function buildAbsoluteReturnUrl(path: string): string | null {
  if (!isAllowedReturnPath(path)) return null;
  return new URL(path, `${ACCOUNT_ORIGIN.replace(/\/$/, "")}/`).toString();
}

export function isAllowedCheckoutHost(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    return host === "checkout.stripe.com" || host.endsWith(".stripe.com");
  } catch {
    return false;
  }
}

export function isAllowedPortalHost(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    return host === "billing.stripe.com" || host.endsWith(".stripe.com");
  } catch {
    return false;
  }
}

export function isAllowedAccountOrigin(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && ALLOWED_ORIGINS.has(`${parsed.protocol}//${parsed.host}`);
  } catch {
    return false;
  }
}

export const PICOM_VERIFIED_PLAN_KEYS = ["picom_verified_monthly", "picom_verified_yearly"] as const;
export type PicomVerifiedPlanKey = (typeof PICOM_VERIFIED_PLAN_KEYS)[number];

export function isPicomVerifiedPlanKey(value: string): value is PicomVerifiedPlanKey {
  return (PICOM_VERIFIED_PLAN_KEYS as readonly string[]).includes(value);
}
