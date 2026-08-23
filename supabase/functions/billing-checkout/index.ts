import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireSupabaseUser } from "../_shared/supabase-auth.ts";
import { errorResponse, jsonResponse, methodNotAllowed } from "../_shared/http.ts";
import { buildAbsoluteReturnUrl, isPicomVerifiedPlanKey, isAllowedCheckoutHost } from "../_shared/billing-allowlist.ts";
import { priceIdForPlan, readStripeConfig, stripeRequest } from "../_shared/billing-stripe.ts";

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return jsonResponse({ ok: true });
  if (request.method !== "POST") return methodNotAllowed(["POST"]);

  const auth = await requireSupabaseUser(request);
  if (!auth.ok) return auth.response;

  const stripe = readStripeConfig();
  if (!stripe) return errorResponse("NOT_CONFIGURED", "PICOM Verified billing provider is not configured.", 503);

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const planKey = typeof body?.planKey === "string" ? body.planKey : "";
  const successReturnPath = typeof body?.successReturnPath === "string" ? body.successReturnPath : "";
  const cancelReturnPath = typeof body?.cancelReturnPath === "string" ? body.cancelReturnPath : "";
  const idempotencyKey = typeof body?.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";

  if (!isPicomVerifiedPlanKey(planKey)) return errorResponse("VALIDATION_ERROR", "Choose a valid PICOM Verified plan.", 400);
  if ("providerPriceId" in (body ?? {}) || "priceId" in (body ?? {})) {
    return errorResponse("VALIDATION_ERROR", "Client-supplied price identifiers are not accepted.", 400);
  }
  const successUrl = buildAbsoluteReturnUrl(successReturnPath);
  const cancelUrl = buildAbsoluteReturnUrl(cancelReturnPath);
  if (!successUrl || !cancelUrl) return errorResponse("VALIDATION_ERROR", "Return URLs must use an allowlisted Account Center path.", 400);
  if (idempotencyKey.length < 8 || idempotencyKey.length > 200) {
    return errorResponse("VALIDATION_ERROR", "A valid idempotency key is required.", 400);
  }

  const serviceUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceUrl || !serviceKey) return errorResponse("NOT_CONFIGURED", "Supabase service role is not configured.", 503);
  const admin = createClient(serviceUrl, serviceKey, { auth: { persistSession: false } });

  const existingCheckout = await admin
    .from("billing_checkout_sessions")
    .select("id,provider_checkout_session_id,status")
    .eq("user_id", auth.user.id)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existingCheckout.data?.provider_checkout_session_id && existingCheckout.data.status !== "expired") {
    const existing = await stripeRequest(stripe, "GET", `checkout/sessions/${existingCheckout.data.provider_checkout_session_id}`);
    if (existing.ok && typeof existing.data.url === "string" && isAllowedCheckoutHost(existing.data.url)) {
      return jsonResponse({ data: { checkoutUrl: existing.data.url, provider: "stripe", planKey } });
    }
  }

  let customerId: string | null = null;
  const existingCustomer = await admin
    .from("billing_customers")
    .select("id,provider_customer_id")
    .eq("user_id", auth.user.id)
    .eq("provider", "stripe")
    .eq("status", "active")
    .maybeSingle();

  if (existingCustomer.data?.provider_customer_id) {
    customerId = existingCustomer.data.provider_customer_id;
  } else {
    const params = new URLSearchParams();
    params.set("metadata[picom_user_id]", auth.user.id);
    if (auth.user.email) params.set("email", auth.user.email);
    const created = await stripeRequest(stripe, "POST", "customers", params, `customer:${auth.user.id}`);
    if (!created.ok || typeof created.data.id !== "string") {
      return errorResponse("UNAVAILABLE", "Unable to create billing customer.", 502);
    }
    customerId = created.data.id;
    await admin.from("billing_customers").insert({
      user_id: auth.user.id,
      provider: "stripe",
      provider_customer_id: customerId,
      status: "active",
    });
  }

  const priceId = priceIdForPlan(stripe, planKey);
  const params = new URLSearchParams();
  params.set("mode", "subscription");
  params.set("customer", customerId);
  params.set("success_url", successUrl);
  params.set("cancel_url", cancelUrl);
  params.set("line_items[0][price]", priceId);
  params.set("line_items[0][quantity]", "1");
  params.set("client_reference_id", auth.user.id);
  params.set("metadata[picom_user_id]", auth.user.id);
  params.set("metadata[plan_key]", planKey);
  params.set("subscription_data[metadata][picom_user_id]", auth.user.id);
  params.set("subscription_data[metadata][plan_key]", planKey);

  const checkout = await stripeRequest(stripe, "POST", "checkout/sessions", params, idempotencyKey);
  if (!checkout.ok || typeof checkout.data.id !== "string" || typeof checkout.data.url !== "string") {
    return errorResponse("UNAVAILABLE", "Unable to create checkout session.", 502);
  }
  if (!isAllowedCheckoutHost(checkout.data.url)) {
    return errorResponse("UNAVAILABLE", "Provider returned an unsafe checkout URL.", 502);
  }

  await admin.from("billing_checkout_sessions").upsert({
    user_id: auth.user.id,
    plan_key: planKey,
    provider: "stripe",
    provider_checkout_session_id: checkout.data.id,
    idempotency_key: idempotencyKey,
    status: "open",
    success_return_path: successReturnPath,
    cancel_return_path: cancelReturnPath,
  }, { onConflict: "user_id,idempotency_key" });

  return jsonResponse({
    data: {
      checkoutUrl: checkout.data.url,
      provider: "stripe",
      planKey,
    },
  });
});
