/**
 * Provider-neutral payment webhook + checkout gate.
 * Fail-closed when PAYMENT_PROVIDER_* secrets are absent.
 * Never trusts client amounts. Never logs secrets.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreflight } from "../_shared/cors.ts";
import { errorResponse, jsonResponse, methodNotAllowed } from "../_shared/http.ts";
import { requireSupabaseUser } from "../_shared/auth.ts";
import { readBoundedJsonObject } from "../_shared/request.ts";

const env = (name: string): string | null => Deno.env.get(name)?.trim() || null;

type ProviderRuntime =
  | { ok: true; provider: string; environment: "TEST" | "LIVE" | "UNKNOWN" }
  | { ok: false; code: string; message: string };

function paymentProviderRuntime(): ProviderRuntime {
  const provider = env("PAYMENT_PROVIDER");
  const secret = env("PAYMENT_PROVIDER_SECRET");
  const webhookSecret = env("PAYMENT_WEBHOOK_SECRET");
  const paymentEnv = (env("PAYMENT_ENV") || "UNKNOWN").toUpperCase();

  if (!provider) {
    return { ok: false, code: "BLOCKED_PROVIDER_CONFIGURATION", message: "PAYMENT_PROVIDER is not configured." };
  }
  if (!secret || !webhookSecret) {
    return {
      ok: false,
      code: "BLOCKED_PROVIDER_CONFIGURATION",
      message: "Payment provider secrets are not configured.",
    };
  }
  const environment = paymentEnv === "TEST" || paymentEnv === "LIVE" ? paymentEnv : "UNKNOWN";
  return { ok: true, provider, environment };
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

async function verifyWebhookSignature(request: Request, rawBody: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const webhookSecret = env("PAYMENT_WEBHOOK_SECRET");
  if (!webhookSecret) return { ok: false, reason: "MISSING_WEBHOOK_SECRET" };

  const signature = request.headers.get("x-picom-payment-signature")
    || request.headers.get("stripe-signature")
    || request.headers.get("x-webhook-signature");
  if (!signature) return { ok: false, reason: "MISSING_SIGNATURE" };

  // Provider-neutral stub: HMAC-SHA256 hex of raw body with webhook secret.
  // Real provider adapters replace this with provider-specific schemes + timestamp tolerance.
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const hex = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");

  const provided = signature.includes("=")
    ? signature.split(",").map((p) => p.trim()).find((p) => p.startsWith("v1="))?.slice(3) ?? signature
    : signature;

  if (!timingSafeEqual(hex, provided)) {
    return { ok: false, reason: "INVALID_SIGNATURE" };
  }
  return { ok: true };
}

const ALLOWED_EVENTS = new Set([
  "payment.succeeded",
  "payment.failed",
  "subscription.created",
  "subscription.updated",
  "subscription.cancelled",
  "invoice.paid",
  "invoice.failed",
  "refund.created",
  "chargeback.created",
  "chargeback.resolved",
  "account.updated",
]);

Deno.serve(async (request) => {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;

  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "");

  // Authenticated checkout create — always fail-closed without provider.
  if (path.endsWith("/checkout") && request.method === "POST") {
    const auth = await requireSupabaseUser(request);
    if (!auth.ok) return auth.response;
    const runtime = paymentProviderRuntime();
    if (!runtime.ok) {
      return errorResponse(runtime.code, runtime.message, 503);
    }
    // Provider adapters not activated until credentials + legal gates certified.
    return errorResponse(
      "LIVE_PAYMENT_ACCEPTANCE_OFF",
      "Live payment acceptance is OFF pending business/legal gates.",
      503,
    );
  }

  // Webhook endpoint
  if (path.endsWith("/webhook") && request.method === "POST") {
    const runtime = paymentProviderRuntime();
    if (!runtime.ok) {
      // Ack safely without economic mutation when provider not configured.
      return jsonResponse({ ok: true, ignored: true, reason: runtime.code }, 202);
    }

    const rawBody = await request.text();
    if (rawBody.length > 256_000) {
      return errorResponse("PAYLOAD_TOO_LARGE", "Webhook payload exceeds bound.", 413);
    }

    const verified = await verifyWebhookSignature(request, rawBody);
    if (!verified.ok) {
      return errorResponse("WEBHOOK_AUTH_DENIED", verified.reason, 401);
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return errorResponse("INVALID_JSON", "Webhook body must be JSON.", 400);
    }

    const eventType = String(payload.type || payload.event_type || "");
    const eventId = String(payload.id || payload.event_id || "");
    const eventEnv = payload.environment
      ? String(payload.environment).toUpperCase()
      : payload.livemode === true
        ? "LIVE"
        : payload.livemode === false
          ? "TEST"
          : "UNKNOWN";

    if (runtime.environment !== "UNKNOWN" && eventEnv !== "UNKNOWN" && eventEnv !== runtime.environment) {
      return jsonResponse({ ok: true, ignored: true, reason: "ENVIRONMENT_MISMATCH" }, 202);
    }

    if (!ALLOWED_EVENTS.has(eventType)) {
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

    // Record idempotent webhook receipt (no secrets / no raw card data).
    const payloadHashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawBody));
    const payloadHash = Array.from(new Uint8Array(payloadHashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const { error } = await operator.from("provider_webhook_events").upsert(
      {
        provider: runtime.provider,
        provider_event_id: eventId || payloadHash,
        event_type: eventType,
        payload_hash: payloadHash,
        processing_status: "received",
      },
      { onConflict: "provider,provider_event_id", ignoreDuplicates: true },
    );

    if (error) {
      await operator.from("publisher_finance_event_failures").upsert(
        {
          provider: runtime.provider,
          provider_event_ref: eventId || payloadHash,
          event_type: eventType,
          error_code: "WEBHOOK_PERSIST_FAILED",
          attempts: 1,
          status: "open",
          safe_context: { message: "persist_failed" },
        },
        { onConflict: "provider,provider_event_ref,error_code" },
      );
      return errorResponse("WEBHOOK_PERSIST_FAILED", "Unable to persist webhook event.", 503);
    }

    // Economic mutations require provider adapters mapped to service_record_* functions.
    // Without certified adapters, acknowledge receipt only.
    return jsonResponse({
      ok: true,
      accepted: true,
      economicMutation: false,
      reason: "PROVIDER_ADAPTER_NOT_CERTIFIED",
    });
  }

  if (request.method === "OPTIONS") return preflight ?? jsonResponse({ ok: true });
  if (request.method !== "POST") return methodNotAllowed(["POST", "OPTIONS"]);

  // Default authenticated status probe
  const auth = await requireSupabaseUser(request);
  if (!auth.ok) return auth.response;
  const parsed = await readBoundedJsonObject<{ action?: string }>(request, {
    maxBytes: 2048,
    allowedKeys: new Set(["action"]),
  });
  if (!parsed.ok) return parsed.response;

  const runtime = paymentProviderRuntime();
  return jsonResponse({
    ok: true,
    providerConfigured: runtime.ok,
    code: runtime.ok ? "PROVIDER_PRESENT" : runtime.code,
    liveAcceptance: "OFF",
    publicMonetization: "OFF",
  });
});
