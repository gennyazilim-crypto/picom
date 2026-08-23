import { ACCOUNT_ORIGIN } from "../config";
import { getAccountSupabase } from "./supabase";

export type PicomEmailVerificationStatus =
  | "pending"
  | "verified"
  | "expired"
  | "email_changed"
  | "delivery_failed";

export type SoftEmailVerificationState = {
  status: PicomEmailVerificationStatus;
  isEmailVerified: boolean;
  emailVerifiedAt: string | null;
  emailMasked: string | null;
  lastSentAt: string | null;
  reminderDismissedAt: string | null;
  successSeenAt: string | null;
  offline?: boolean;
};

function functionsBase(): string {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, "");
  if (!url) throw new Error("Missing VITE_SUPABASE_URL");
  return `${url}/functions/v1`;
}

async function authHeader(): Promise<HeadersInit> {
  const supabase = getAccountSupabase();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? "";
  if (!token) throw new Error("AUTH_REQUIRED");
  return {
    Authorization: `Bearer ${token}`,
    apikey: anon,
    "Content-Type": "application/json",
  };
}

export async function fetchSoftEmailVerificationStatus(): Promise<SoftEmailVerificationState> {
  try {
    const headers = await authHeader();
    const response = await fetch(`${functionsBase()}/get-email-verification-status`, {
      method: "GET",
      headers,
    });
    if (!response.ok) {
      // Fallback to RPC if function not deployed yet.
      return await fetchStatusViaRpc();
    }
    const body = await response.json() as {
      status?: string;
      isEmailVerified?: boolean;
      emailVerifiedAt?: string | null;
      emailMasked?: string | null;
      lastSentAt?: string | null;
      reminderDismissedAt?: string | null;
      successSeenAt?: string | null;
    };
    return normalize(body);
  } catch {
    try {
      return await fetchStatusViaRpc();
    } catch {
      return {
        status: "pending",
        isEmailVerified: false,
        emailVerifiedAt: null,
        emailMasked: null,
        lastSentAt: null,
        reminderDismissedAt: null,
        successSeenAt: null,
        offline: true,
      };
    }
  }
}

async function fetchStatusViaRpc(): Promise<SoftEmailVerificationState> {
  const supabase = getAccountSupabase();
  const { data, error } = await supabase.rpc("get_my_email_verification_status");
  if (error) throw error;
  const body = data as Record<string, unknown>;
  return normalize({
    status: String(body.status ?? "pending"),
    isEmailVerified: Boolean(body.is_email_verified),
    emailVerifiedAt: (body.email_verified_at as string | null) ?? null,
    emailMasked: (body.email_masked as string | null) ?? null,
    lastSentAt: (body.last_sent_at as string | null) ?? null,
    reminderDismissedAt: (body.reminder_dismissed_at as string | null) ?? null,
    successSeenAt: (body.success_seen_at as string | null) ?? null,
  });
}

function normalize(body: {
  status?: string;
  isEmailVerified?: boolean;
  emailVerifiedAt?: string | null;
  emailMasked?: string | null;
  lastSentAt?: string | null;
  reminderDismissedAt?: string | null;
  successSeenAt?: string | null;
}): SoftEmailVerificationState {
  const status = (body.status ?? "pending") as PicomEmailVerificationStatus;
  return {
    status,
    isEmailVerified: Boolean(body.isEmailVerified ?? status === "verified"),
    emailVerifiedAt: body.emailVerifiedAt ?? null,
    emailMasked: body.emailMasked ?? null,
    lastSentAt: body.lastSentAt ?? null,
    reminderDismissedAt: body.reminderDismissedAt ?? null,
    successSeenAt: body.successSeenAt ?? null,
  };
}

export async function sendSoftEmailVerification(kind: "send" | "resend" = "resend"): Promise<
  { ok: true; alreadyVerified?: boolean } | { ok: false; rateLimited?: boolean; message: string }
> {
  const path = kind === "send" ? "send-email-verification" : "resend-email-verification";
  try {
    const headers = await authHeader();
    const response = await fetch(`${functionsBase()}/${path}`, {
      method: "POST",
      headers,
      body: "{}",
    });
    const body = await response.json().catch(() => ({})) as {
      ok?: boolean;
      alreadyVerified?: boolean;
      message?: string;
      code?: string;
    };
    if (response.status === 429 || body.code === "RATE_LIMITED") {
      return {
        ok: false,
        rateLimited: true,
        message: body.message ?? "Yeni doğrulama e-postası istemeden önce lütfen bir süre bekleyin.",
      };
    }
    if (!response.ok) {
      return {
        ok: false,
        message: body.message ?? (response.status === 502
          ? "Doğrulama e-postası gönderilemedi. Biraz sonra tekrar deneyin."
          : "Verification email could not be sent."),
      };
    }
    return { ok: true, alreadyVerified: Boolean(body.alreadyVerified) };
  } catch {
    return { ok: false, message: "Verification email could not be sent." };
  }
}

export async function consumeSoftEmailVerificationToken(token: string): Promise<
  | { ok: true; status: "success" }
  | { ok: false; status: "invalid" | "expired" | "already_used" | "email_changed" | "server_error" }
> {
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? "";
  const response = await fetch(`${functionsBase()}/verify-email-address`, {
    method: "POST",
    headers: {
      apikey: anon,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token }),
  });
  const body = await response.json().catch(() => ({})) as { ok?: boolean; status?: string };
  if (body.ok && body.status === "success") return { ok: true, status: "success" };
  const status = (body.status ?? "invalid") as "invalid" | "expired" | "already_used" | "email_changed" | "server_error";
  return { ok: false, status };
}

export async function dismissSoftEmailReminder(): Promise<void> {
  const supabase = getAccountSupabase();
  await supabase.rpc("dismiss_email_verification_reminder");
}

export async function markSoftEmailSuccessSeen(): Promise<void> {
  const supabase = getAccountSupabase();
  await supabase.rpc("mark_email_verification_success_seen");
}

export function softVerifyEmailPageUrl(token?: string): string {
  if (token) return `${ACCOUNT_ORIGIN}/verify-email/${encodeURIComponent(token)}`;
  return `${ACCOUNT_ORIGIN}/verify-email`;
}

export function softEmailSecurityUrl(): string {
  return `${ACCOUNT_ORIGIN}/account/security/email`;
}
