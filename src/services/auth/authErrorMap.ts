import type { AuthServiceErrorCode } from "../authService";

export const AUTH_ERROR_CODES = [
  "AUTH_DISABLED",
  "AUTH_NOT_CONFIGURED",
  "AUTH_INVALID_INPUT",
  "AUTH_INVALID_CREDENTIALS",
  "AUTH_ACCOUNT_RESTRICTED",
  "AUTH_RATE_LIMITED",
  "AUTH_SESSION_EXPIRED",
  "AUTH_PROVIDER_ERROR",
  "AUTH_NETWORK_ERROR",
  "AUTH_ACCOUNT_DISABLED",
  "AUTH_PROVIDER_FAILED",
  "AUTH_CALLBACK_FAILED",
  "AUTH_SESSION_FAILED",
  "AUTH_IDENTITY_ALREADY_LINKED",
  "AUTH_CANCELLED",
] as const satisfies readonly AuthServiceErrorCode[];

const AUTH_ERROR_CODE_SET = new Set<string>(AUTH_ERROR_CODES);

export function isAuthErrorCode(value: string | null | undefined): value is AuthServiceErrorCode {
  return Boolean(value && AUTH_ERROR_CODE_SET.has(value));
}

export function authErrorI18nKey(code: string | null | undefined): `error.${AuthServiceErrorCode}` {
  if (isAuthErrorCode(code)) return `error.${code}`;
  return "error.AUTH_PROVIDER_FAILED";
}

export function canonicalizeAuthErrorCode(code: string | null | undefined): AuthServiceErrorCode {
  if (code === "AUTH_PROVIDER_ERROR") return "AUTH_PROVIDER_FAILED";
  if (code === "AUTH_ACCOUNT_RESTRICTED") return "AUTH_ACCOUNT_DISABLED";
  if (code === "AUTH_SESSION_EXPIRED") return "AUTH_SESSION_FAILED";
  return isAuthErrorCode(code) ? code : "AUTH_PROVIDER_FAILED";
}

export const AUTH_ERROR_FALLBACK: Record<AuthServiceErrorCode, string> = {
  AUTH_DISABLED: "Authentication is unavailable right now.",
  AUTH_NOT_CONFIGURED: "Authentication is not configured.",
  AUTH_INVALID_INPUT: "Check the details you entered and try again.",
  AUTH_INVALID_CREDENTIALS: "Email or password is incorrect.",
  AUTH_ACCOUNT_RESTRICTED: "This account is unavailable. Contact support if you believe this is a mistake.",
  AUTH_RATE_LIMITED: "Too many attempts. Please wait and try again.",
  AUTH_SESSION_EXPIRED: "Your session expired. Please sign in again.",
  AUTH_PROVIDER_ERROR: "Authentication failed. Please try again.",
  AUTH_NETWORK_ERROR: "We could not reach authentication. Check your connection and try again.",
  AUTH_ACCOUNT_DISABLED: "This account is unavailable. Contact support if you believe this is a mistake.",
  AUTH_PROVIDER_FAILED: "Authentication failed. Please try again.",
  AUTH_CALLBACK_FAILED: "This sign-in link is invalid or has already been used. Please try again.",
  AUTH_SESSION_FAILED: "Your session could not be restored. Please sign in again.",
  AUTH_IDENTITY_ALREADY_LINKED: "This provider account is already linked to another PICOM user.",
  AUTH_CANCELLED: "Sign-in was cancelled.",
};

export function authErrorFallbackMessage(code: string | null | undefined): string {
  return AUTH_ERROR_FALLBACK[canonicalizeAuthErrorCode(code)];
}
