import { getSupabaseClient } from "./supabase/supabaseClient";
import { accountCenterUrls } from "../config/accountCenterUrls";
import { appConfig } from "../config/appConfig";

export type SoftEmailVerificationStatus =
  | "pending"
  | "verified"
  | "expired"
  | "email_changed"
  | "delivery_failed";

export type SoftEmailStatusSnapshot = {
  status: SoftEmailVerificationStatus;
  isEmailVerified: boolean;
  emailMasked: string | null;
  lastSentAt: string | null;
  reminderDismissedAt: string | null;
  successSeenAt: string | null;
  offline?: boolean;
};

const SESSION_DISMISS_KEY = "picom.softEmail.reminderDismissedSession";
const NATIVE_NOTIFY_KEY = "picom.softEmail.nativeNotifyAt";

function functionsBase(): string | null {
  const url = appConfig.supabase.url?.replace(/\/+$/, "");
  return url ? `${url}/functions/v1` : null;
}

async function bearerHeaders(): Promise<HeadersInit | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  return {
    Authorization: `Bearer ${token}`,
    apikey: appConfig.supabase.anonKey,
    "Content-Type": "application/json",
  };
}

export async function loadSoftEmailStatus(): Promise<SoftEmailStatusSnapshot> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      status: "pending",
      isEmailVerified: false,
      emailMasked: null,
      lastSentAt: null,
      reminderDismissedAt: null,
      successSeenAt: null,
      offline: true,
    };
  }

  try {
    const headers = await bearerHeaders();
    const base = functionsBase();
    if (headers && base) {
      const response = await fetch(`${base}/get-email-verification-status`, { method: "GET", headers });
      if (response.ok) {
        const body = await response.json() as Record<string, unknown>;
        return {
          status: (body.status as SoftEmailVerificationStatus) ?? "pending",
          isEmailVerified: Boolean(body.isEmailVerified),
          emailMasked: (body.emailMasked as string | null) ?? null,
          lastSentAt: (body.lastSentAt as string | null) ?? null,
          reminderDismissedAt: (body.reminderDismissedAt as string | null) ?? null,
          successSeenAt: (body.successSeenAt as string | null) ?? null,
        };
      }
    }

    const { data, error } = await client.rpc("get_my_email_verification_status");
    if (error) throw error;
    const body = (data ?? {}) as Record<string, unknown>;
    return {
      status: (body.status as SoftEmailVerificationStatus) ?? "pending",
      isEmailVerified: Boolean(body.is_email_verified),
      emailMasked: (body.email_masked as string | null) ?? null,
      lastSentAt: (body.last_sent_at as string | null) ?? null,
      reminderDismissedAt: (body.reminder_dismissed_at as string | null) ?? null,
      successSeenAt: (body.success_seen_at as string | null) ?? null,
    };
  } catch {
    return {
      status: "pending",
      isEmailVerified: false,
      emailMasked: null,
      lastSentAt: null,
      reminderDismissedAt: null,
      successSeenAt: null,
      offline: true,
    };
  }
}

export async function resendSoftEmailVerification(): Promise<
  { ok: true } | { ok: false; rateLimited?: boolean; message: string }
> {
  const headers = await bearerHeaders();
  const base = functionsBase();
  if (!headers || !base) return { ok: false, message: "Not signed in." };
  const response = await fetch(`${base}/resend-email-verification`, {
    method: "POST",
    headers,
    body: "{}",
  });
  const body = await response.json().catch(() => ({})) as { message?: string; code?: string };
  if (response.status === 429 || body.code === "RATE_LIMITED") {
    return {
      ok: false,
      rateLimited: true,
      message: body.message ?? "Yeni doğrulama e-postası istemeden önce lütfen bir süre bekleyin.",
    };
  }
  if (!response.ok) return { ok: false, message: body.message ?? "Could not send verification email." };
  return { ok: true };
}

export async function dismissSoftEmailReminder(): Promise<void> {
  try {
    sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
  } catch {
    // ignore
  }
  const client = getSupabaseClient();
  if (!client) return;
  await client.rpc("dismiss_email_verification_reminder");
}

export function isSoftEmailReminderDismissedThisSession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export async function markSoftEmailSuccessSeen(): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  await client.rpc("mark_email_verification_success_seen");
}

export function softEmailCheckInboxUrl(): string {
  return accountCenterUrls.manageAccount.replace("/account/overview", "/account/security/email");
}

export function softEmailSecurityUrl(): string {
  return `${accountCenterUrls.origin}/account/security/email?source=desktop`;
}

/** Native notification at most once per 72h; skip if dismissed today. */
export function shouldShowNativeSoftEmailNotification(status: SoftEmailStatusSnapshot): boolean {
  if (status.isEmailVerified || status.offline) return false;
  if (isSoftEmailReminderDismissedThisSession()) return false;
  try {
    const raw = localStorage.getItem(NATIVE_NOTIFY_KEY);
    if (!raw) return true;
    const last = Number(raw);
    if (!Number.isFinite(last)) return true;
    return Date.now() - last >= 72 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function markNativeSoftEmailNotificationShown(): void {
  try {
    localStorage.setItem(NATIVE_NOTIFY_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}
