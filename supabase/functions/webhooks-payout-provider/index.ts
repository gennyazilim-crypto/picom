import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { errorResponse, jsonResponse, methodNotAllowed } from "../_shared/http.ts";
import {
  normalizeAccountState,
  PAYOUT_WEBHOOK_EVENT_TYPES,
  readPayoutProviderConfig,
  retrieveAccount,
  retrieveTransferOrPayout,
  verifyPayoutWebhookEvent,
} from "../_shared/payout-provider.ts";

type StripeEvent = {
  id?: string;
  type?: string;
  data?: { object?: Record<string, unknown> };
};

async function sha256Hex(raw: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return methodNotAllowed(["POST"]);

  const config = readPayoutProviderConfig();
  if (!config) {
    return errorResponse("PAYOUT_PROVIDER_NOT_CONFIGURED", "Payout webhook secret is missing — fail-closed.", 503);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return errorResponse("NOT_CONFIGURED", "Supabase service role is not configured.", 503);

  const rawBody = await request.text();
  if (!rawBody) return errorResponse("VALIDATION_ERROR", "Webhook body is required.", 400);

  const signature = request.headers.get("Stripe-Signature");
  const verified = await verifyPayoutWebhookEvent(rawBody, signature, config.webhookSecret);
  if (!verified.ok) return errorResponse("WEBHOOK_INVALID", "Webhook signature validation failed.", 401);

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return errorResponse("VALIDATION_ERROR", "Invalid JSON.", 400);
  }

  const eventId = typeof event.id === "string" ? event.id : null;
  const eventType = typeof event.type === "string" ? event.type : null;
  if (!eventId || !eventType) return errorResponse("VALIDATION_ERROR", "Event id/type required.", 400);

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: existing } = await admin
    .from("provider_webhook_events")
    .select("id,processing_status")
    .eq("provider", "stripe_connect")
    .eq("provider_event_id", eventId)
    .maybeSingle();

  if (existing?.processing_status === "processed") {
    return jsonResponse({ ok: true, duplicate: true });
  }

  if (!existing) {
    await admin.from("provider_webhook_events").insert({
      provider: "stripe_connect",
      provider_event_id: eventId,
      event_type: eventType,
      processing_status: "received",
      payload_hash: await sha256Hex(rawBody),
    });
  }

  const handled = new Set<string>(PAYOUT_WEBHOOK_EVENT_TYPES as unknown as string[]);
  if (!handled.has(eventType)) {
    await admin.from("provider_webhook_events").update({
      processing_status: "ignored",
      processed_at: new Date().toISOString(),
    }).eq("provider", "stripe_connect").eq("provider_event_id", eventId);
    return jsonResponse({ ok: true, ignored: true });
  }

  const object = event.data?.object ?? {};

  try {
    if (eventType.startsWith("account.") || eventType === "capability.updated" || eventType === "external_account.updated") {
      const accountId = typeof object.id === "string" ? object.id : null;
      if (accountId) {
        const retrieved = await retrieveAccount(config, accountId);
        const account = retrieved.ok ? retrieved.data : object;
        const normalized = normalizeAccountState(account);
        await admin.rpc("apply_provider_payout_account_state", {
          target_provider_account_id: accountId,
          target_onboarding_status: normalized.onboarding_status,
          target_capabilities_status: normalized.capabilities_status,
          target_payout_status: normalized.payout_status,
          target_requirements_status: normalized.requirements_status,
        });
      }
    }

    if (eventType.startsWith("transfer.") || eventType.startsWith("payout.")) {
      const transferId = typeof object.id === "string" ? object.id : null;
      if (transferId) {
        if (eventType.includes("created") || eventType.includes("failed")) {
          await retrieveTransferOrPayout(config, transferId);
        }
        let mapped: "paid" | "failed" | "returned" | null = null;
        if (eventType.endsWith(".paid")) mapped = "paid";
        else if (eventType.endsWith(".failed")) mapped = "failed";
        else if (eventType.includes("reversed") || eventType.includes("canceled")) mapped = "returned";
        if (mapped) {
          await admin.rpc("apply_provider_payout_item_event", {
            target_provider_transfer_id: transferId,
            target_event: mapped,
            target_failure_code: typeof object.failure_code === "string" ? object.failure_code : null,
            target_idempotency_key: eventId,
          });
        }
      }
    }

    await admin.from("provider_webhook_events").update({
      processing_status: "processed",
      processed_at: new Date().toISOString(),
    }).eq("provider", "stripe_connect").eq("provider_event_id", eventId);

    return jsonResponse({ ok: true });
  } catch {
    await admin.from("provider_webhook_events").update({
      processing_status: "failed",
      processed_at: new Date().toISOString(),
    }).eq("provider", "stripe_connect").eq("provider_event_id", eventId);
    return errorResponse("PROCESSING_ERROR", "Webhook processing failed.", 500);
  }
});
