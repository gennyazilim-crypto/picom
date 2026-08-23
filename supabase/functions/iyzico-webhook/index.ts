import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { errorResponse, jsonResponse, methodNotAllowed } from "../_shared/http.ts";
import { readIyzicoConfig, verifyIyzicoWebhookSignature } from "../_shared/iyzico.ts";
import { reconcileIyzicoVerifiedPayment } from "../_shared/iyzico-verified-payment.ts";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return methodNotAllowed(["POST"]);

  const config = readIyzicoConfig();
  if (!config || !config.webhookSignatureEnabled) {
    return errorResponse("PROVIDER_VERIFICATION_BLOCKED", "iyzico webhook signature verification is not configured.", 503);
  }
  const serviceUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceUrl || !serviceKey) return errorResponse("SUPABASE_NOT_CONFIGURED", "Payment service is not configured.", 503);

  const rawBody = await request.text();
  if (!rawBody) return errorResponse("VALIDATION_ERROR", "Webhook body is required.", 400);
  let payload: Record<string, unknown>;
  try {
    const parsed = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid payload");
    payload = parsed as Record<string, unknown>;
  } catch {
    return errorResponse("VALIDATION_ERROR", "Webhook payload must be JSON.", 400);
  }

  const signature = request.headers.get("X-IYZ-SIGNATURE-V3");
  if (!await verifyIyzicoWebhookSignature(config, payload, signature)) {
    return errorResponse("WEBHOOK_INVALID", "Webhook signature validation failed.", 401);
  }

  const eventType = asString(payload.iyziEventType);
  const paymentId = asString(payload.paymentId) ?? asString(payload.iyziPaymentId);
  const conversationId = asString(payload.paymentConversationId) ?? asString(payload.conversationId);
  const eventTime = asString(payload.iyziEventTime) ?? "";
  if (!eventType || !paymentId || !conversationId) return errorResponse("VALIDATION_ERROR", "Webhook payment correlation is required.", 400);

  const admin = createClient(serviceUrl, serviceKey, { auth: { persistSession: false } });
  const providerEventId = asString(payload.iyziReferenceCode) ?? await sha256Hex(`${eventType}:${paymentId}:${conversationId}:${eventTime}`);
  const payloadHash = await sha256Hex(rawBody);
  const claimed = await admin.from("provider_webhook_events").insert({
    provider: "iyzico",
    provider_event_id: providerEventId,
    event_type: eventType,
    payload_hash: payloadHash,
    processing_status: "processing",
    processing_started_at: new Date().toISOString(),
  }).select("id").maybeSingle();
  if (claimed.error) {
    if (claimed.error.code === "23505") return jsonResponse({ ok: true, duplicate: true });
    return errorResponse("UNAVAILABLE", "Unable to claim webhook event.", 500);
  }

  const intent = await admin.from("verified_payment_intents")
    .select("id")
    .eq("provider", "iyzico")
    .eq("conversation_id", conversationId)
    .maybeSingle();
  if (!intent.data?.id) {
    await admin.from("provider_webhook_events").update({ processing_status: "ignored", processed_at: new Date().toISOString() })
      .eq("provider", "iyzico").eq("provider_event_id", providerEventId);
    return jsonResponse({ ok: true, ignored: true });
  }

  const result = await reconcileIyzicoVerifiedPayment(admin, config, intent.data.id, "webhook");
  if (result.outcome === "unavailable") {
    await admin.from("provider_webhook_events").update({
      processing_status: "retry_scheduled",
      next_retry_at: new Date(Date.now() + 60_000).toISOString(),
      last_error_code: result.failureCode ?? "PROCESSING_FAILED",
      last_error_message_safe: "Payment retrieval or activation was unavailable.",
    }).eq("provider", "iyzico").eq("provider_event_id", providerEventId);
    return errorResponse("UNAVAILABLE", "Payment verification will be retried. No entitlement was activated.", 500);
  }

  await admin.from("provider_webhook_events").update({
    processing_status: "processed",
    processed_at: new Date().toISOString(),
  }).eq("provider", "iyzico").eq("provider_event_id", providerEventId);
  return jsonResponse({ ok: true, outcome: result.outcome });
});
