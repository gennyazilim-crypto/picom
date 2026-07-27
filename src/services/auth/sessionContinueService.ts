import { appConfig } from "../config/appConfig";
import { getSupabaseClient } from "../supabase/supabaseClient";
import { authService, type AuthServiceResult } from "../authService";

const NONCE_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

function sessionContinueEndpoint(): string {
  return `${appConfig.supabase.url.replace(/\/+$/, "")}/functions/v1/session-continue`;
}

export function generateSessionContinueNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function isValidSessionContinueNonce(value: string | null | undefined): value is string {
  return typeof value === "string" && NONCE_PATTERN.test(value);
}

async function pollOnce(nonce: string): Promise<{ status: string; session: { access_token?: string; refresh_token?: string } | null }> {
  const response = await fetch(
    `${sessionContinueEndpoint()}?action=poll&nonce=${encodeURIComponent(nonce)}`,
    { headers: { apikey: appConfig.supabase.anonKey } },
  );
  return (await response.json()) as { status: string; session: { access_token?: string; refresh_token?: string } | null };
}

/**
 * Poll until Account Center parks a one-time session for this nonce, then setSession locally.
 */
export async function pollSessionContinue(
  nonce: string,
  options?: { timeoutMs?: number; intervalMs?: number; signal?: AbortSignal },
): Promise<AuthServiceResult<{ message: string }>> {
  if (!isValidSessionContinueNonce(nonce)) {
    return { ok: false, error: { code: "AUTH_INVALID_INPUT", message: "Invalid session handoff." } };
  }

  const timeoutMs = options?.timeoutMs ?? 150_000;
  const intervalMs = options?.intervalMs ?? 2500;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (options?.signal?.aborted) {
      return { ok: false, error: { code: "AUTH_SESSION_EXPIRED", message: "Session handoff canceled." } };
    }
    try {
      const payload = await pollOnce(nonce);
      if (payload.status === "ready" && payload.session?.access_token && payload.session.refresh_token) {
        return authService.establishSession(payload.session.access_token, payload.session.refresh_token);
      }
      if (payload.status === "consumed" || payload.status === "expired") {
        break;
      }
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return { ok: false, error: { code: "AUTH_SESSION_EXPIRED", message: "Account handoff timed out. Sign in with your new email and password." } };
}

/** Redeem a handoff nonce once (web /auth/handoff or desktop deep link). */
export async function consumeSessionContinue(nonce: string): Promise<AuthServiceResult<{ message: string }>> {
  if (!isValidSessionContinueNonce(nonce)) {
    return { ok: false, error: { code: "AUTH_INVALID_INPUT", message: "Invalid session handoff." } };
  }
  try {
    const payload = await pollOnce(nonce);
    if (payload.status === "ready" && payload.session?.access_token && payload.session.refresh_token) {
      return authService.establishSession(payload.session.access_token, payload.session.refresh_token);
    }
  } catch {
    // fall through
  }
  return { ok: false, error: { code: "AUTH_SESSION_EXPIRED", message: "This sign-in link expired. Sign in again." } };
}

/** Optional: apply tokens already present (tests / emergency). Prefer nonce handoff. */
export async function establishLocalSession(
  accessToken: string,
  refreshToken: string,
): Promise<AuthServiceResult<{ message: string }>> {
  const client = getSupabaseClient();
  if (!client) {
    return { ok: false, error: { code: "AUTH_NOT_CONFIGURED", message: "Supabase Auth is not configured." } };
  }
  return authService.establishSession(accessToken, refreshToken);
}
