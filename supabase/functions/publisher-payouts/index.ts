/**
 * Provider-neutral KYC + payout onboarding/webhook gate.
 * Fail-closed without KYC/PAYOUT provider secrets. No fake verification.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreflight } from "../_shared/cors.ts";
import { errorResponse, jsonResponse, methodNotAllowed } from "../_shared/http.ts";
import { requireSupabaseUser } from "../_shared/auth.ts";
import { readBoundedJsonObject } from "../_shared/request.ts";

const env = (name: string): string | null => Deno.env.get(name)?.trim() || null;

function kycProviderReady(): boolean {
  return Boolean(env("KYC_PROVIDER") && env("KYC_PROVIDER_SECRET") && env("KYC_WEBHOOK_SECRET"));
}

function payoutProviderReady(): boolean {
  return Boolean(env("PAYOUT_PROVIDER") && env("PAYOUT_PROVIDER_SECRET") && env("PAYOUT_WEBHOOK_SECRET"));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

async function verifySignature(request: Request, rawBody: string, secretName: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const secret = env(secretName);
  if (!secret) return { ok: false, reason: "MISSING_WEBHOOK_SECRET" };
  const signature = request.headers.get("x-picom-payment-signature")
    || request.headers.get("x-webhook-signature")
    || request.headers.get("stripe-signature");
  if (!signature) return { ok: false, reason: "MISSING_SIGNATURE" };

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const hex = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const provided = signature.includes("=")
    ? signature.split(",").map((p) => p.trim()).find((p) => p.startsWith("v1="))?.slice(3) ?? signature
    : signature;
  if (!timingSafeEqual(hex, provided)) return { ok: false, reason: "INVALID_SIGNATURE" };
  return { ok: true };
}

const KYC_EVENTS = new Set(["account.updated", "identity.verified", "identity.requires_input", "capability.updated"]);
const PAYOUT_EVENTS = new Set([
  "payout.created",
  "payout.paid",
  "payout.failed",
  "payout.canceled",
  "payout.cancelled",
  "payout.reversed",
  "account.updated",
]);

Deno.serve(async (request) => {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "");

  if (path.endsWith("/kyc/session") && request.method === "POST") {
    const auth = await requireSupabaseUser(request);
    if (!auth.ok) return auth.response;
    if (!kycProviderReady()) {
      return errorResponse("BLOCKED_PROVIDER_CONFIGURATION", "KYC provider is not configured.", 503);
    }
    return errorResponse("LIVE_KYC_OFF", "Live KYC acceptance is OFF pending business/legal gates.", 503);
  }

  if (path.endsWith("/payout-account/onboarding") && request.method === "POST") {
    const auth = await requireSupabaseUser(request);
    if (!auth.ok) return auth.response;
    if (!payoutProviderReady()) {
      return errorResponse("BLOCKED_PROVIDER_CONFIGURATION", "Payout provider is not configured.", 503);
    }
    return errorResponse("LIVE_PAYOUT_OFF", "Live payouts are OFF pending business approval.", 503);
  }

  if (path.endsWith("/webhook/kyc") && request.method === "POST") {
    if (!kycProviderReady()) {
      return jsonResponse({ ok: true, ignored: true, reason: "BLOCKED_PROVIDER_CONFIGURATION" }, 202);
    }
    const rawBody = await request.text();
    if (rawBody.length > 256_000) return errorResponse("PAYLOAD_TOO_LARGE", "Payload too large.", 413);
    const verified = await verifySignature(request, rawBody, "KYC_WEBHOOK_SECRET");
    if (!verified.ok) return errorResponse("WEBHOOK_AUTH_DENIED", verified.reason, 401);
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return errorResponse("INVALID_JSON", "Invalid JSON.", 400);
    }
    const eventType = String(payload.type || payload.event_type || "");
    if (!KYC_EVENTS.has(eventType)) {
      return jsonResponse({ ok: true, ignored: true, reason: "UNKNOWN_EVENT" }, 202);
    }
    return jsonResponse({ ok: true, accepted: true, economicMutation: false, reason: "KYC_ADAPTER_NOT_CERTIFIED" });
  }

  if (path.endsWith("/webhook/payout") && request.method === "POST") {
    if (!payoutProviderReady()) {
      return jsonResponse({ ok: true, ignored: true, reason: "BLOCKED_PROVIDER_CONFIGURATION" }, 202);
    }
    const rawBody = await request.text();
    if (rawBody.length > 256_000) return errorResponse("PAYLOAD_TOO_LARGE", "Payload too large.", 413);
    const verified = await verifySignature(request, rawBody, "PAYOUT_WEBHOOK_SECRET");
    if (!verified.ok) return errorResponse("WEBHOOK_AUTH_DENIED", verified.reason, 401);
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return errorResponse("INVALID_JSON", "Invalid JSON.", 400);
    }
    const eventType = String(payload.type || payload.event_type || "");
    if (!PAYOUT_EVENTS.has(eventType)) {
      return jsonResponse({ ok: true, ignored: true, reason: "UNKNOWN_EVENT" }, 202);
    }

    const supabaseUrl = env("SUPABASE_URL");
    const serviceRole = env("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRole) {
      return errorResponse("INTERNAL_ERROR", "Webhook processor is not configured.", 503);
    }
    const operator = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const payloadHashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawBody));
    const payloadHash = Array.from(new Uint8Array(payloadHashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
    const eventId = String(payload.id || payload.event_id || payloadHash);
    await operator.from("provider_webhook_events").upsert(
      {
        provider: env("PAYOUT_PROVIDER") || "payout",
        provider_event_id: eventId,
        event_type: eventType,
        payload_hash: payloadHash,
        processing_status: "received",
      },
      { onConflict: "provider,provider_event_id", ignoreDuplicates: true },
    );
    return jsonResponse({
      ok: true,
      accepted: true,
      economicMutation: false,
      reason: "PAYOUT_ADAPTER_NOT_CERTIFIED",
      livePayouts: "OFF",
    });
  }

  if (request.method === "OPTIONS") return preflight ?? jsonResponse({ ok: true });
  if (request.method !== "POST") return methodNotAllowed(["POST", "OPTIONS"]);

  const auth = await requireSupabaseUser(request);
  if (!auth.ok) return auth.response;
  const parsed = await readBoundedJsonObject<{ action?: string }>(request, {
    maxBytes: 2048,
    allowedKeys: new Set(["action"]),
  });
  if (!parsed.ok) return parsed.response;

  return jsonResponse({
    ok: true,
    kycProviderConfigured: kycProviderReady(),
    payoutProviderConfigured: payoutProviderReady(),
    livePayouts: "OFF",
    code: kycProviderReady() || payoutProviderReady() ? "PARTIAL" : "BLOCKED_PROVIDER_CONFIGURATION",
  });
});
