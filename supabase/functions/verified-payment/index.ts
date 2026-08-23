import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireSupabaseUser } from "../_shared/supabase-auth.ts";
import { errorResponse, jsonResponse, methodNotAllowed } from "../_shared/http.ts";
import { isPicomVerifiedPlanKey } from "../_shared/billing-allowlist.ts";
import {
  isAllowedIyzicoPaymentUrl,
  iyzicoRequest,
  minorToIyzicoAmount,
  readIyzicoConfig,
} from "../_shared/iyzico.ts";
import { reconcileIyzicoVerifiedPayment } from "../_shared/iyzico-verified-payment.ts";

type ActivePlan = Readonly<{
  plan_key: "picom_verified_monthly" | "picom_verified_yearly";
  billing_interval: "month" | "year";
  interval_count: number;
  currency: string;
  amount_minor: number;
}>;

function asActivePlan(value: unknown): ActivePlan | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  return isPicomVerifiedPlanKey(String(row.plan_key ?? ""))
    && (row.billing_interval === "month" || row.billing_interval === "year")
    && typeof row.interval_count === "number"
    && Number.isSafeInteger(row.interval_count)
    && typeof row.currency === "string"
    && /^[A-Z]{3}$/.test(row.currency)
    && typeof row.amount_minor === "number"
    && Number.isSafeInteger(row.amount_minor)
    && row.amount_minor >= 0
    ? row as ActivePlan
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function appendAudit(admin: any, intentId: string, eventType: string, source: "server" | "reconciliation", safeMetadata: Record<string, unknown> = {}): Promise<void> {
  await admin.from("verified_payment_audit_events").insert({
    payment_intent_id: intentId,
    event_type: eventType,
    source,
    safe_metadata: safeMetadata,
  });
}

async function resolveCanonicalPlan(admin: any, planKey: string): Promise<ActivePlan | null> {
  const response = await admin.from("billing_products")
    .select("plan_key,billing_interval,interval_count,currency,amount_minor,effective_from")
    .eq("product_key", "picom_verified")
    .eq("plan_key", planKey)
    .eq("status", "active")
    .order("effective_from", { ascending: false });
  const plans = Array.isArray(response.data) ? response.data.map(asActivePlan).filter((plan): plan is ActivePlan => plan !== null) : [];
  if (plans.length === 0) return null;
  const [first] = plans;
  if (plans.some((plan) => plan.amount_minor !== first.amount_minor || plan.currency !== first.currency || plan.billing_interval !== first.billing_interval || plan.interval_count !== first.interval_count)) {
    return null;
  }
  return first;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return jsonResponse({ ok: true });
  if (request.method !== "POST") return methodNotAllowed(["POST"]);

  const auth = await requireSupabaseUser(request);
  if (!auth.ok) return auth.response;

  const config = readIyzicoConfig();
  if (!config) return errorResponse("PROVIDER_VERIFICATION_BLOCKED", "Verified payment is unavailable until iyzico Link and payment-retrieval credentials are configured.", 503);

  const serviceUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceUrl || !serviceKey) return errorResponse("SUPABASE_NOT_CONFIGURED", "Payment service is not configured.", 503);
  const admin = createClient(serviceUrl, serviceKey, { auth: { persistSession: false } });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const action = asString(body?.action) ?? "create";

  if (action === "reconcile") {
    const intentId = asString(body?.intentId);
    if (!intentId || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(intentId)) {
      return errorResponse("VALIDATION_ERROR", "A valid payment intent is required.", 400);
    }
    const owner = await admin.from("verified_payment_intents").select("id").eq("id", intentId).eq("user_id", auth.user.id).maybeSingle();
    if (!owner.data) return errorResponse("PAYMENT_INTENT_NOT_FOUND", "Payment intent was not found.", 404);
    const result = await reconcileIyzicoVerifiedPayment(admin, config, intentId, "reconciliation");
    if (result.outcome === "unavailable") return errorResponse("PAYMENT_RECONCILIATION_UNAVAILABLE", "Payment verification is temporarily unavailable. No entitlement was activated.", 502);
    return jsonResponse({ data: result });
  }

  if (action !== "create") return errorResponse("VALIDATION_ERROR", "Unsupported payment action.", 400);
  const planKey = asString(body?.planKey) ?? "";
  const idempotencyKey = asString(body?.idempotencyKey) ?? "";
  if (!isPicomVerifiedPlanKey(planKey)) return errorResponse("VALIDATION_ERROR", "Choose a valid PICOM Verified plan.", 400);
  if (idempotencyKey.length < 8 || idempotencyKey.length > 200) return errorResponse("VALIDATION_ERROR", "A valid idempotency key is required.", 400);
  if ("amount" in (body ?? {}) || "amountMinor" in (body ?? {}) || "currency" in (body ?? {}) || "userId" in (body ?? {})) {
    return errorResponse("VALIDATION_ERROR", "Plan price, currency, and user identity are determined by the server.", 400);
  }

  const existing = await admin.from("verified_payment_intents")
    .select("id,status,payment_url,expires_at")
    .eq("user_id", auth.user.id)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existing.data?.payment_url && existing.data.status === "awaiting_payment" && Date.parse(existing.data.expires_at) > Date.now()) {
    return jsonResponse({ data: { intentId: existing.data.id, paymentUrl: existing.data.payment_url, status: "awaiting_payment" } });
  }
  if (existing.data) return errorResponse("VALIDATION_ERROR", "Create a new payment request to retry this checkout.", 409);

  const plan = await resolveCanonicalPlan(admin, planKey);
  const amount = plan ? minorToIyzicoAmount(plan.amount_minor) : null;
  if (!plan || !amount) return errorResponse("PLAN_NOT_CONFIGURED", "The selected Verified plan does not have one canonical active price.", 503);

  const conversationId = `pv1_${crypto.randomUUID().replace(/-/g, "")}`;
  const expiresAt = new Date(Date.now() + config.intentTtlMinutes * 60_000).toISOString();
  const inserted = await admin.from("verified_payment_intents").insert({
    user_id: auth.user.id,
    provider: "iyzico",
    product_key: "picom_verified",
    plan_key: plan.plan_key,
    billing_interval: plan.billing_interval,
    interval_count: plan.interval_count,
    expected_amount_minor: plan.amount_minor,
    currency: plan.currency,
    conversation_id: conversationId,
    idempotency_key: idempotencyKey,
    status: "created",
    expires_at: expiresAt,
  }).select("id").maybeSingle();
  if (!inserted.data?.id) return errorResponse("UNAVAILABLE", "Unable to create a payment request.", 503);

  const createdLink = await iyzicoRequest(config, "POST", "/v2/iyzilink/products", {
    conversationId,
    locale: "en",
    name: `PICOM Verified ${plan.billing_interval === "year" ? "Yearly" : "Monthly"}`,
    description: "PICOM Verified Individual",
    price: amount,
    currencyCode: plan.currency,
    encodedImageFile: config.linkProductImageBase64,
    addressIgnorable: true,
    installmentRequested: false,
    stockEnabled: false,
    categoryType: "UNKNOWN",
  });
  const linkData = createdLink.ok && createdLink.data.status === "success" && createdLink.data.data && typeof createdLink.data.data === "object"
    ? createdLink.data.data as Record<string, unknown>
    : null;
  const token = asString(linkData?.token);
  const paymentUrl = asString(linkData?.url);
  if (!token || !paymentUrl || !isAllowedIyzicoPaymentUrl(paymentUrl)) {
    await admin.from("verified_payment_intents").update({ status: "failed", failure_code: "IYZICO_LINK_CREATE_FAILED" }).eq("id", inserted.data.id);
    await appendAudit(admin, inserted.data.id, "link_creation_failed", "server");
    return errorResponse("UNAVAILABLE", "Unable to create a secure iyzico payment link.", 502);
  }

  await admin.from("verified_payment_intents").update({
    status: "awaiting_payment",
    provider_link_token: token,
    payment_url: paymentUrl,
  }).eq("id", inserted.data.id);
  await appendAudit(admin, inserted.data.id, "link_created", "server", { planKey: plan.plan_key, billingInterval: plan.billing_interval });

  return jsonResponse({ data: { intentId: inserted.data.id, paymentUrl, status: "awaiting_payment" } });
});
