/**
 * Shared soft email verification helpers for Edge Functions.
 * Tokens are never logged; only SHA-256 hashes are persisted.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type SoftStatus = "pending" | "verified" | "expired" | "email_changed" | "delivery_failed";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export function requiredEnv(name: string): string | null {
  const value = Deno.env.get(name);
  return value && value.trim() ? value.trim() : null;
}

export function accountCenterUrl(): string {
  return (requiredEnv("ACCOUNT_CENTER_URL") ?? "https://account.picom.gg").replace(/\/+$/, "");
}

export function emailFromAddress(): string {
  return requiredEnv("EMAIL_FROM_ADDRESS") ?? "verify@picom.gg";
}

export function emailReplyTo(): string {
  return requiredEnv("EMAIL_REPLY_TO") ?? "support@picom.gg";
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function maskEmail(email: string): string {
  const normalized = normalizeEmail(email);
  const at = normalized.indexOf("@");
  if (at <= 0) return "***";
  return `${normalized[0]}***${normalized.slice(at)}`;
}

export function createServiceClient() {
  const url = requiredEnv("SUPABASE_URL");
  const key = requiredEnv("SUPABASE_SERVICE_ROLE_KEY") ?? requiredEnv("SUPABASE_SECRET_KEY");
  if (!url || !key) throw new Error("SERVICE_CLIENT_UNAVAILABLE");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function generateOpaqueToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function audit(
  admin: ReturnType<typeof createServiceClient>,
  userId: string,
  eventType: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await admin.from("account_security_events").insert({
    user_id: userId,
    event_type: eventType,
    metadata,
  });
}

type RateLimitResult = { ok: true } | { ok: false; code: "RATE_LIMITED" };

export async function checkResendRateLimit(
  admin: ReturnType<typeof createServiceClient>,
  userId: string,
): Promise<RateLimitResult> {
  const { data } = await admin
    .from("profiles")
    .select("email_verification_last_sent_at")
    .eq("id", userId)
    .maybeSingle();

  const lastSent = data?.email_verification_last_sent_at
    ? Date.parse(String(data.email_verification_last_sent_at))
    : 0;
  if (lastSent && Date.now() - lastSent < 60_000) {
    return { ok: false, code: "RATE_LIMITED" };
  }

  const sinceHour = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: hourCount } = await admin
    .from("user_email_verifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", sinceHour);

  if ((hourCount ?? 0) >= 3) return { ok: false, code: "RATE_LIMITED" };

  const sinceDay = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: dayCount } = await admin
    .from("user_email_verifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", sinceDay);

  if ((dayCount ?? 0) >= 5) return { ok: false, code: "RATE_LIMITED" };

  return { ok: true };
}

export async function invalidatePendingTokens(
  admin: ReturnType<typeof createServiceClient>,
  userId: string,
): Promise<void> {
  await admin
    .from("user_email_verifications")
    .update({
      status: "invalidated",
      invalidated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("status", "pending");
}

export async function createVerificationToken(
  admin: ReturnType<typeof createServiceClient>,
  userId: string,
  email: string,
): Promise<{ token: string; expiresAt: string }> {
  await invalidatePendingTokens(admin, userId);
  const token = generateOpaqueToken();
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  const emailNormalized = normalizeEmail(email);

  const { error } = await admin.from("user_email_verifications").insert({
    user_id: userId,
    email_normalized: emailNormalized,
    token_hash: tokenHash,
    status: "pending",
    expires_at: expiresAt,
  });
  if (error) throw new Error(error.message);

  await admin
    .from("profiles")
    .update({
      email_verification_status: "pending",
      email_verified_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  await audit(admin, userId, "email_verification_created", {
    email_masked: maskEmail(emailNormalized),
    expires_at: expiresAt,
  });

  return { token, expiresAt };
}

export async function sendVerificationEmail(input: {
  to: string;
  displayName: string;
  verifyUrl: string;
  expiresAt: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const apiKey = requiredEnv("EMAIL_PROVIDER_API_KEY") ?? requiredEnv("RESEND_API_KEY");
  const from = `PICOM Verification <${emailFromAddress()}>`;
  const replyTo = emailReplyTo();
  const subject = "PICOM e-posta adresinizi doğrulayın";
  const text = [
    `Merhaba ${input.displayName || "PICOM kullanıcısı"},`,
    "",
    "PICOM hesabınız hazır ve kullanıma açıktır. E-posta adresinizi doğrulayarak hesap kurtarma ve güvenlik bildirimlerini güvence altına alabilirsiniz.",
    "",
    `Doğrulama bağlantısı: ${input.verifyUrl}`,
    `Bu bağlantı ${input.expiresAt} tarihine kadar geçerlidir.`,
    "",
    "Bu işlemi siz yapmadıysanız support@picom.gg adresine yazın.",
    "",
    "PICOM",
  ].join("\n");

  const html = `<!doctype html><html><body style="font-family:Segoe UI,Arial,sans-serif;background:#15181a;color:#e8ecef;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#22262a;border:1px solid #3a424a;border-radius:12px;padding:28px">
    <p style="color:#14b8a6;font-weight:700;letter-spacing:.04em">PICOM</p>
    <h1 style="font-size:1.35rem;margin:0 0 12px">E-posta adresinizi doğrulayın</h1>
    <p>Merhaba ${escapeHtml(input.displayName || "PICOM kullanıcısı")},</p>
    <p>PICOM hesabınız hazır ve kullanıma açıktır. E-posta adresinizi doğrulayarak hesap kurtarma ve güvenlik bildirimlerini güvence altına alabilirsiniz.</p>
    <p style="margin:28px 0"><a href="${escapeHtml(input.verifyUrl)}" style="background:#0d9488;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:600">E-postamı Doğrula</a></p>
    <p style="color:#9aa3ab;font-size:0.9rem">Bağlantı geçerlilik süresi: ${escapeHtml(input.expiresAt)}</p>
    <p style="color:#9aa3ab;font-size:0.9rem">Bu işlemi siz yapmadıysanız <a href="mailto:support@picom.gg" style="color:#14b8a6">support@picom.gg</a> adresine yazın.</p>
  </div></body></html>`;

  if (!apiKey) {
    // Local/dev without provider: treat as delivery_failed signal for caller.
    return { ok: false, message: "EMAIL_PROVIDER_API_KEY is not configured" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      reply_to: replyTo,
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    return { ok: false, message: `provider_status_${response.status}` };
  }
  return { ok: true };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function issueAndSendVerification(
  admin: ReturnType<typeof createServiceClient>,
  userId: string,
  email: string,
  displayName: string,
  auditEvent: "email_verification_sent" | "email_verification_resent",
): Promise<{ ok: true; emailMasked: string } | { ok: false; code: string; message: string }> {
  const rate = await checkResendRateLimit(admin, userId);
  if (!rate.ok) {
    await audit(admin, userId, "email_verification_rate_limited", {});
    return {
      ok: false,
      code: "RATE_LIMITED",
      message: "Yeni doğrulama e-postası istemeden önce lütfen bir süre bekleyin.",
    };
  }

  let token: string;
  let expiresAt: string;
  try {
    ({ token, expiresAt } = await createVerificationToken(admin, userId, email));
  } catch (error) {
    return { ok: false, code: "INTERNAL_ERROR", message: "Verification token could not be created." };
  }

  const verifyUrl = `${accountCenterUrl()}/verify-email?token=${encodeURIComponent(token)}`;
  const sent = await sendVerificationEmail({
    to: normalizeEmail(email),
    displayName,
    verifyUrl,
    expiresAt,
  });

  if (!sent.ok) {
    await admin
      .from("profiles")
      .update({
        email_verification_status: "delivery_failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
    await audit(admin, userId, "email_verification_delivery_failed", {
      email_masked: maskEmail(email),
      reason: sent.message,
    });
    return {
      ok: false,
      code: "DELIVERY_FAILED",
      message: "Doğrulama e-postası gönderilemedi. Biraz sonra tekrar deneyin.",
    };
  }

  await admin
    .from("profiles")
    .update({
      email_verification_last_sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  await audit(admin, userId, auditEvent, { email_masked: maskEmail(email) });
  return { ok: true, emailMasked: maskEmail(email) };
}

export async function consumeVerificationToken(
  admin: ReturnType<typeof createServiceClient>,
  rawToken: string,
): Promise<
  | { ok: true; userId: string }
  | { ok: false; code: "invalid" | "expired" | "already_used" | "email_changed" | "server_error" }
> {
  if (!rawToken || rawToken.length < 16 || rawToken.length > 256) {
    return { ok: false, code: "invalid" };
  }

  const tokenHash = await sha256Hex(rawToken);
  const { data: row, error } = await admin
    .from("user_email_verifications")
    .select("id,user_id,email_normalized,status,expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) return { ok: false, code: "server_error" };
  if (!row) {
    return { ok: false, code: "invalid" };
  }

  if (row.status === "consumed") return { ok: false, code: "already_used" };
  if (row.status === "invalidated" || row.status === "expired") return { ok: false, code: "expired" };
  if (row.status !== "pending") return { ok: false, code: "invalid" };

  if (Date.parse(String(row.expires_at)) < Date.now()) {
    await admin
      .from("user_email_verifications")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", row.id);
    await audit(admin, row.user_id, "email_verification_expired", {});
    return { ok: false, code: "expired" };
  }

  const { data: authUser, error: authError } = await admin.auth.admin.getUserById(row.user_id);
  if (authError || !authUser.user?.email) {
    await audit(admin, row.user_id, "email_verification_invalid_token", { reason: "user_missing" });
    return { ok: false, code: "invalid" };
  }

  if (normalizeEmail(authUser.user.email) !== normalizeEmail(String(row.email_normalized))) {
    await audit(admin, row.user_id, "email_verification_invalid_token", { reason: "email_changed" });
    return { ok: false, code: "email_changed" };
  }

  const now = new Date().toISOString();
  const { error: consumeError } = await admin
    .from("user_email_verifications")
    .update({
      status: "consumed",
      consumed_at: now,
      updated_at: now,
    })
    .eq("id", row.id)
    .eq("status", "pending");

  if (consumeError) return { ok: false, code: "server_error" };

  await admin
    .from("profiles")
    .update({
      email_verification_status: "verified",
      email_verified_at: now,
      email_verification_reminder_dismissed_at: null,
      updated_at: now,
    })
    .eq("id", row.user_id);

  await audit(admin, row.user_id, "email_verification_completed", {
    email_masked: maskEmail(String(row.email_normalized)),
  });

  return { ok: true, userId: row.user_id };
}
