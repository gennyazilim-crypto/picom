import { createClient } from "npm:@supabase/supabase-js@2";
import {
  EMAIL_CATEGORIES,
  EMAIL_LOCALES,
  createEmailQueueService,
  type EmailCategory,
  type EmailLocale,
} from "../_shared/email-service.ts";

type Json = Record<string, unknown>;
type AuthUser = Readonly<{ id: string; email: string | null }>;

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const unsubscribeSecret = Deno.env.get("EMAIL_UNSUBSCRIBE_SECRET") ?? "";
const rateLimitSalt = Deno.env.get("EMAIL_RATE_LIMIT_SALT") ?? "";
const turnstileSecret = Deno.env.get("TURNSTILE_SECRET_KEY") ?? "";
const allowedOrigins = new Set(
  (Deno.env.get("PICOM_ALLOWED_ORIGINS") ?? "https://picom.gg,http://127.0.0.1:5173")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error("Email API is missing required Supabase server configuration.");
}

const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const emailQueue = createEmailQueueService(serviceClient);

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin") ?? "";
  const allowedOrigin = allowedOrigins.has(origin) || origin === "null" || origin === "file://"
    ? origin
    : [...allowedOrigins][0] ?? "https://picom.gg";
  return {
    "access-control-allow-origin": allowedOrigin,
    "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

function requestOriginAllowed(request: Request): boolean {
  const origin = request.headers.get("origin") ?? "";
  if (!origin || allowedOrigins.has(origin)) return true;
  const desktopOpaqueOrigin = origin === "null" || origin === "file://";
  return desktopOpaqueOrigin && (request.headers.get("authorization") ?? "").toLowerCase().startsWith("bearer ");
}

function json(request: Request, status: number, body: Json): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function error(request: Request, status: number, code: string, message: string): Response {
  return json(request, status, { ok: false, error: { code, message } });
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function locale(value: unknown): EmailLocale {
  return typeof value === "string" && EMAIL_LOCALES.includes(value as EmailLocale)
    ? value as EmailLocale
    : "en";
}

function userClient(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  return createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: authorization ? { Authorization: authorization } : {} },
  });
}

async function currentUser(request: Request): Promise<AuthUser | null> {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return null;
  const client = userClient(request);
  const { data, error: authError } = await client.auth.getUser();
  if (authError || !data.user) return null;
  return { id: data.user.id, email: data.user.email?.trim().toLowerCase() ?? null };
}

async function requireAdmin(request: Request): Promise<boolean> {
  const client = userClient(request);
  const { data, error: rpcError } = await client.rpc("is_app_admin");
  return !rpcError && data === true;
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function consumeRateLimit(scope: string, key: string, limit: number, windowSeconds: number): Promise<boolean> {
  if (!rateLimitSalt) return false;
  const bucket = await sha256(`${rateLimitSalt}:${scope}:${key}`);
  const { data, error: rpcError } = await serviceClient.rpc("consume_email_rate_limit", {
    p_bucket_hash: bucket,
    p_scope: scope,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  return !rpcError && data === true;
}

async function verifyTurnstile(token: string, remoteIp: string): Promise<boolean> {
  if (!turnstileSecret || !token) return false;
  const body = new URLSearchParams({ secret: turnstileSecret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) return false;
  const result = await response.json().catch(() => null) as { success?: boolean } | null;
  return result?.success === true;
}

async function createSupportSubmission(request: Request, body: Json, user: AuthUser | null): Promise<Response> {
  const origin = request.headers.get("origin") ?? "";
  if (origin && !allowedOrigins.has(origin) && !user) return error(request, 403, "EMAIL_ORIGIN_DENIED", "This origin is not allowed.");

  const name = text(body.name, 100) || "Picom user";
  const emailAddress = (user?.email ?? text(body.email, 320)).toLowerCase();
  const subject = text(body.subject, 160);
  const message = text(body.message, 5_000);
  const source = user ? "authenticated_support" : "public_contact";
  const correlationId = crypto.randomUUID();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress) || subject.length < 3 || message.length < 10) {
    return error(request, 400, "EMAIL_VALIDATION_FAILED", "Enter a valid email, subject, and message.");
  }

  const remoteIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!user && !await verifyTurnstile(text(body.turnstileToken, 2_000), remoteIp)) {
    return error(request, 403, "EMAIL_CHALLENGE_REQUIRED", "Complete the anti-abuse challenge and try again.");
  }
  const rateKey = user?.id ?? `${remoteIp}:${emailAddress}`;
  if (!await consumeRateLimit(source, rateKey, user ? 8 : 3, 3_600)) {
    return error(request, 429, "EMAIL_RATE_LIMITED", "Too many requests. Try again later.");
  }

  const { data: submission, error: submissionError } = await serviceClient.rpc("create_email_contact_submission", {
    p_user_id: user?.id ?? null,
    p_email: emailAddress,
    p_name: name,
    p_subject: subject,
    p_body: message,
    p_source: source,
    p_correlation_id: correlationId,
  });
  if (submissionError || !submission || typeof submission !== "object") {
    return error(request, 503, "EMAIL_SUBMISSION_FAILED", "Picom could not create the support request.");
  }
  const submissionId = text((submission as Json).id, 80) || correlationId;
  const parameters = { name, email: emailAddress, subject, message, submissionId };
  const [acknowledgement, internal] = await Promise.all([
    emailQueue.enqueue({
      to: emailAddress,
      recipientUserId: user?.id,
      templateId: "support_ticket_received",
      category: "support_updates",
      locale: locale(body.locale),
      parameters,
      idempotencyKey: `support-ack:${submissionId}`,
      correlationId,
      priority: 65,
    }),
    emailQueue.enqueue({
      to: "info@picom.gg",
      templateId: "support_internal_contact",
      category: "support_updates",
      locale: "en",
      parameters,
      idempotencyKey: `support-internal:${submissionId}`,
      correlationId,
      priority: 85,
    }),
  ]);
  if (!internal.ok) return error(request, 503, internal.code, "The request was recorded but notification could not be queued.");
  return json(request, 202, {
    ok: true,
    data: { status: "queued", submissionId, acknowledgementQueued: acknowledgement.ok },
  });
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

async function verifyUnsubscribeToken(token: string): Promise<{ emailHash: string; category: EmailCategory } | null> {
  if (!unsubscribeSecret) return null;
  const [payloadPart, signaturePart] = token.split(".");
  if (!payloadPart || !signaturePart) return null;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(unsubscribeSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    decodeBase64Url(signaturePart),
    new TextEncoder().encode(payloadPart),
  ).catch(() => false);
  if (!valid) return null;
  const payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(payloadPart))) as Json;
  const emailHash = text(payload.emailHash, 128);
  const category = text(payload.category, 64) as EmailCategory;
  const expiresAt = Number(payload.exp ?? 0);
  if (!/^[a-f0-9]{64}$/.test(emailHash) || !EMAIL_CATEGORIES.includes(category) || expiresAt < Math.floor(Date.now() / 1000)) return null;
  return { emailHash, category };
}

async function unsubscribe(request: Request, token: string): Promise<Response> {
  const verified = await verifyUnsubscribeToken(token);
  if (!verified) return error(request, 400, "EMAIL_UNSUBSCRIBE_INVALID", "This unsubscribe link is invalid or expired.");
  const { error: rpcError } = await serviceClient.rpc("suppress_email_recipient", {
    p_user_id: null,
    p_email_hash: verified.emailHash,
    p_category: verified.category,
    p_reason: "user_unsubscribed",
    p_source: "one_click",
  });
  if (rpcError) return error(request, 503, "EMAIL_UNSUBSCRIBE_FAILED", "The preference could not be saved.");
  return json(request, 200, { ok: true, data: { status: "unsubscribed", category: verified.category } });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request) });
  const origin = request.headers.get("origin") ?? "";
  if (!requestOriginAllowed(request)) return error(request, 403, "EMAIL_ORIGIN_DENIED", "This origin is not allowed.");

  const url = new URL(request.url);
  if (request.method === "POST" && url.searchParams.get("action") === "unsubscribe") {
    return unsubscribe(request, text(url.searchParams.get("token"), 4_000));
  }
  if (request.method !== "POST") return error(request, 405, "EMAIL_METHOD_NOT_ALLOWED", "Use POST for this endpoint.");

  const body = await request.json().catch(() => null) as Json | null;
  if (!body) return error(request, 400, "EMAIL_INVALID_JSON", "A valid JSON request is required.");
  const action = text(body.action, 80);
  const user = await currentUser(request);

  if (action === "contact.submit") return createSupportSubmission(request, body, user);
  if (action === "support.submit") {
    if (!user) return error(request, 401, "AUTH_REQUIRED", "Sign in before submitting a support request.");
    return createSupportSubmission(request, body, user);
  }
  if (action === "unsubscribe.confirm") return unsubscribe(request, text(body.token, 4_000));

  if (!user) return error(request, 401, "AUTH_REQUIRED", "Sign in to continue.");
  const client = userClient(request);
  if (action === "preferences.get") {
    const { data, error: rpcError } = await client.rpc("get_email_preferences");
    return rpcError ? error(request, 503, "EMAIL_PREFERENCES_FAILED", "Email preferences are unavailable.") : json(request, 200, { ok: true, data });
  }
  if (action === "preferences.update") {
    const patch = body.preferences && typeof body.preferences === "object" ? body.preferences : {};
    const { data, error: rpcError } = await client.rpc("update_email_preferences", { patch });
    return rpcError ? error(request, 400, "EMAIL_PREFERENCES_FAILED", "Email preferences could not be updated.") : json(request, 200, { ok: true, data });
  }

  if (!action.startsWith("admin.") || !await requireAdmin(request)) {
    return error(request, 403, "EMAIL_ADMIN_FORBIDDEN", "Root email operations access is required.");
  }
  if (action === "admin.summary") {
    const { data, error: rpcError } = await client.rpc("get_email_operations_summary");
    return rpcError ? error(request, 503, "EMAIL_ADMIN_FAILED", "Email operations summary is unavailable.") : json(request, 200, { ok: true, data });
  }
  if (action === "admin.list") {
    const { data, error: rpcError } = await client.rpc("list_email_operations", { p_limit: Math.min(Math.max(Number(body.limit ?? 50), 1), 100) });
    return rpcError ? error(request, 503, "EMAIL_ADMIN_FAILED", "Email operations list is unavailable.") : json(request, 200, { ok: true, data });
  }
  if (action === "admin.retry" || action === "admin.cancel") {
    const messageId = text(body.messageId, 80);
    const rpcName = action === "admin.retry" ? "admin_retry_email" : "admin_cancel_email";
    const { data, error: rpcError } = await client.rpc(rpcName, { p_message_id: messageId });
    return rpcError || data !== true ? error(request, 400, "EMAIL_ADMIN_ACTION_FAILED", "The email action could not be completed.") : json(request, 200, { ok: true, data: { updated: true } });
  }
  if (action === "admin.test") {
    if (!user.email) return error(request, 400, "EMAIL_ADMIN_TEST_FAILED", "The admin account has no email address.");
    const correlationId = crypto.randomUUID();
    const queued = await emailQueue.enqueue({
      to: user.email,
      recipientUserId: user.id,
      templateId: "security_alert",
      category: "required_account_security",
      locale: locale(body.locale),
      parameters: { title: "Picom email transport test", message: "This message verifies the protected Picom email queue." },
      idempotencyKey: `admin-test:${user.id}:${Math.floor(Date.now() / 60_000)}`,
      correlationId,
      priority: 90,
    });
    return queued.ok ? json(request, 202, { ok: true, data: queued }) : error(request, 503, queued.code, queued.message);
  }
  return error(request, 404, "EMAIL_ACTION_NOT_FOUND", "Requested email action was not found.");
});
