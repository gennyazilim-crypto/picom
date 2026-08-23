import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { errorResponse, jsonResponse, methodNotAllowed } from "../_shared/http.ts";
import { readStripeConfig, sha256Hex, verifyStripeWebhookSignature } from "../_shared/billing-stripe.ts";

type StripeEvent = {
  id?: string;
  type?: string;
  api_version?: string;
  created?: number;
  data?: { object?: Record<string, unknown> };
};

const HANDLED = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.payment_action_required",
  "charge.refunded",
  "charge.dispute.created",
  "charge.dispute.closed",
  "identity.verification_session.verified",
  "identity.verification_session.requires_input",
  "identity.verification_session.canceled",
]);

function mapSubscriptionStatus(status: string | undefined, cancelAtPeriodEnd: boolean): string {
  switch (status) {
    case "incomplete":
    case "incomplete_expired":
      return status === "incomplete_expired" ? "expired" : "incomplete";
    case "trialing":
      return "trialing";
    case "active":
      return cancelAtPeriodEnd ? "active" : "active";
    case "past_due":
      return "past_due";
    case "canceled":
      return "cancelled";
    case "unpaid":
      return "unpaid";
    case "paused":
      return "paused";
    default:
      return "incomplete";
  }
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return methodNotAllowed(["POST"]);

  const stripe = readStripeConfig();
  if (!stripe) return errorResponse("NOT_CONFIGURED", "Billing webhook processing is not configured.", 503);

  const serviceUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceUrl || !serviceKey) return errorResponse("NOT_CONFIGURED", "Supabase service role is not configured.", 503);

  const rawBody = await request.text();
  if (!rawBody) return errorResponse("VALIDATION_ERROR", "Webhook body is required.", 400);

  const signature = request.headers.get("Stripe-Signature");
  const isIdentity = rawBody.includes("identity.verification_session");
  const secret = isIdentity && stripe.identityWebhookSecret ? stripe.identityWebhookSecret : stripe.webhookSecret;
  const verified = await verifyStripeWebhookSignature(rawBody, signature, secret);
  if (!verified.ok) return errorResponse("WEBHOOK_INVALID", "Webhook signature validation failed.", 401);

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return errorResponse("VALIDATION_ERROR", "Webhook payload must be JSON.", 400);
  }

  const eventId = asString(event.id);
  const eventType = asString(event.type);
  if (!eventId || !eventType) return errorResponse("VALIDATION_ERROR", "Webhook event identity is required.", 400);

  const admin = createClient(serviceUrl, serviceKey, { auth: { persistSession: false } });
  const payloadHash = await sha256Hex(rawBody);

  const insert = await admin.from("provider_webhook_events").insert({
    provider: "stripe",
    provider_event_id: eventId,
    event_type: eventType,
    api_version: asString(event.api_version),
    payload_hash: payloadHash,
    payload_created_at: event.created ? new Date(event.created * 1000).toISOString() : null,
    processing_status: "processing",
    processing_started_at: new Date().toISOString(),
  }).select("id").maybeSingle();

  if (insert.error) {
    if (insert.error.code === "23505") {
      return jsonResponse({ ok: true, duplicate: true });
    }
    return errorResponse("UNAVAILABLE", "Unable to claim webhook event.", 500);
  }

  if (!HANDLED.has(eventType)) {
    await admin.from("provider_webhook_events").update({
      processing_status: "ignored",
      processed_at: new Date().toISOString(),
    }).eq("provider", "stripe").eq("provider_event_id", eventId);
    return jsonResponse({ ok: true, ignored: true });
  }

  try {
    const object = event.data?.object ?? {};
    const metadata = (object.metadata as Record<string, unknown> | undefined) ?? {};
    let userId = asString(metadata.picom_user_id);

    if (eventType.startsWith("customer.subscription.") || eventType === "checkout.session.completed") {
      const subscriptionId = eventType === "checkout.session.completed"
        ? asString(object.subscription)
        : asString(object.id);
      if (!userId && asString(object.client_reference_id)) userId = asString(object.client_reference_id);
      if (!userId && asString(object.customer)) {
        const customer = await admin.from("billing_customers").select("user_id").eq("provider_customer_id", asString(object.customer)).maybeSingle();
        userId = customer.data?.user_id ?? null;
      }

      if (userId && subscriptionId) {
        const customerRow = await admin.from("billing_customers").select("id").eq("user_id", userId).eq("provider", "stripe").maybeSingle();
        const status = mapSubscriptionStatus(asString(object.status) ?? undefined, object.cancel_at_period_end === true);
        const planKey = asString(metadata.plan_key) === "picom_verified_yearly" ? "picom_verified_yearly" : "picom_verified_monthly";
        const priceId = asString(((object.items as { data?: Array<{ price?: { id?: string } }> } | undefined)?.data?.[0]?.price?.id)
          ?? asString(object.price)
          ?? "unknown";
        const stateVersion = asNumber(object.created) ?? Math.floor(Date.now() / 1000);
        const existing = await admin.from("picom_verified_subscriptions").select("id,provider_state_version").eq("provider_subscription_id", subscriptionId).maybeSingle();
        if (!existing.data || (existing.data.provider_state_version ?? 0) <= stateVersion) {
          const payload = {
            user_id: userId,
            billing_customer_id: customerRow.data?.id,
            product_key: "picom_verified",
            plan_key: planKey,
            provider: "stripe",
            provider_subscription_id: subscriptionId,
            provider_price_id: priceId,
            status: status === "past_due" ? "grace_period" : status,
            cancel_at_period_end: object.cancel_at_period_end === true,
            current_period_start: asNumber(object.current_period_start) ? new Date((object.current_period_start as number) * 1000).toISOString() : null,
            current_period_end: asNumber(object.current_period_end) ? new Date((object.current_period_end as number) * 1000).toISOString() : null,
            grace_until: status === "past_due" && asNumber(object.current_period_end)
              ? new Date(((object.current_period_end as number) + 3 * 24 * 3600) * 1000).toISOString()
              : null,
            cancelled_at: status === "cancelled" ? new Date().toISOString() : null,
            ended_at: status === "expired" || status === "cancelled" ? new Date().toISOString() : null,
            last_payment_status: eventType,
            provider_state_version: stateVersion,
          };
          if (existing.data?.id) {
            await admin.from("picom_verified_subscriptions").update(payload).eq("id", existing.data.id);
          } else if (payload.billing_customer_id) {
            await admin.from("picom_verified_subscriptions").insert(payload);
          }
          await admin.rpc("reconcile_picom_verified_entitlements", {
            target_user_id: userId,
            source_event: eventType,
          });
          if (status === "active" || status === "trialing" || status === "grace_period") {
            await admin.rpc("enqueue_email_for_user_event", {
              target_user_id: userId,
              target_template_id: "subscription_confirmation",
              target_category: "billing",
              target_parameters: { summary: "Your PICOM Verified subscription was updated.", reference: eventType },
              target_idempotency_key: `verified-sub:${eventId}`,
              target_correlation_id: eventId,
              target_priority: 80,
              target_hook_name: "picom_verified_subscription",
              target_source_record_id: eventId,
            });
          } else if (eventType === "invoice.payment_failed" || status === "past_due" || status === "unpaid") {
            await admin.rpc("enqueue_email_for_user_event", {
              target_user_id: userId,
              target_template_id: "payment_failure",
              target_category: "billing",
              target_parameters: { summary: "A PICOM Verified payment requires attention.", reference: eventType },
              target_idempotency_key: `verified-payfail:${eventId}`,
              target_correlation_id: eventId,
              target_priority: 90,
              target_hook_name: "picom_verified_payment",
              target_source_record_id: eventId,
            });
          }
        }
      }
    }

    if (eventType.startsWith("invoice.")) {
      const subscriptionId = asString(object.subscription);
      const invoiceId = asString(object.id);
      if (subscriptionId && invoiceId) {
        const sub = await admin.from("picom_verified_subscriptions").select("id,user_id").eq("provider_subscription_id", subscriptionId).maybeSingle();
        if (sub.data) {
          await admin.from("billing_invoices").upsert({
            subscription_id: sub.data.id,
            user_id: sub.data.user_id,
            provider_invoice_id: invoiceId,
            provider_payment_intent_id: asString(object.payment_intent),
            status: asString(object.status) === "paid" ? "paid" : asString(object.status) === "open" ? "open" : "failed",
            amount_due_minor: asNumber(object.amount_due) ?? 0,
            amount_paid_minor: asNumber(object.amount_paid) ?? 0,
            currency: (asString(object.currency) ?? "usd").toUpperCase(),
            hosted_invoice_url: asString(object.hosted_invoice_url),
            invoice_pdf_url: asString(object.invoice_pdf),
            paid_at: asString(object.status) === "paid" ? new Date().toISOString() : null,
            failed_at: eventType === "invoice.payment_failed" ? new Date().toISOString() : null,
          }, { onConflict: "provider_invoice_id" });
        }
      }
    }

    if (eventType.startsWith("identity.verification_session.")) {
      const sessionId = asString(object.id);
      const metaUser = asString(metadata.picom_user_id);
      if (sessionId) {
        const status = eventType.endsWith(".verified")
          ? "verified"
          : eventType.endsWith(".requires_input")
          ? "requires_input"
          : "canceled";
        const session = await admin.from("account_verification_sessions").select("id,user_id,verification_case_id").eq("provider_session_id", sessionId).maybeSingle();
        const targetUser = session.data?.user_id ?? metaUser;
        if (session.data) {
          await admin.from("account_verification_sessions").update({
            status,
            completed_at: status === "verified" || status === "canceled" ? new Date().toISOString() : null,
            provider_state_version: asNumber(object.created) ?? Math.floor(Date.now() / 1000),
          }).eq("id", session.data.id);
          await admin.from("verification_cases").update({
            status: status === "verified" ? "verified" : status === "requires_input" ? "requires_input" : "cancelled",
            reviewed_at: status === "verified" ? new Date().toISOString() : null,
          }).eq("id", session.data.verification_case_id);
        }
        if (targetUser) {
          await admin.rpc("reconcile_verified_account_badge", {
            target_user_id: targetUser,
            source_event: eventType,
          });
        }
      }
    }

    await admin.from("provider_webhook_events").update({
      processing_status: "processed",
      processed_at: new Date().toISOString(),
    }).eq("provider", "stripe").eq("provider_event_id", eventId);

    return jsonResponse({ ok: true });
  } catch {
    await admin.from("provider_webhook_events").update({
      processing_status: "retry_scheduled",
      next_retry_at: new Date(Date.now() + 60_000).toISOString(),
      last_error_code: "PROCESSING_FAILED",
      last_error_message_safe: "Webhook processing failed.",
    }).eq("provider", "stripe").eq("provider_event_id", eventId);
    return errorResponse("UNAVAILABLE", "Webhook processing failed and will be retried.", 500);
  }
});
