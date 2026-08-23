import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireSupabaseUser } from "../_shared/supabase-auth.ts";
import { errorResponse, jsonResponse, methodNotAllowed } from "../_shared/http.ts";
import { buildAbsoluteReturnUrl, isAllowedPortalHost } from "../_shared/billing-allowlist.ts";
import { readStripeConfig, stripeRequest } from "../_shared/billing-stripe.ts";

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return jsonResponse({ ok: true });
  if (request.method !== "POST") return methodNotAllowed(["POST"]);

  const auth = await requireSupabaseUser(request);
  if (!auth.ok) return auth.response;

  const stripe = readStripeConfig();
  if (!stripe) return errorResponse("NOT_CONFIGURED", "PICOM Verified billing provider is not configured.", 503);

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const returnPath = typeof body?.returnPath === "string" ? body.returnPath : "/account/billing";
  const returnUrl = buildAbsoluteReturnUrl(returnPath);
  if (!returnUrl) return errorResponse("VALIDATION_ERROR", "Return URL must use an allowlisted Account Center path.", 400);

  const serviceUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceUrl || !serviceKey) return errorResponse("NOT_CONFIGURED", "Supabase service role is not configured.", 503);
  const admin = createClient(serviceUrl, serviceKey, { auth: { persistSession: false } });

  const customer = await admin
    .from("billing_customers")
    .select("provider_customer_id")
    .eq("user_id", auth.user.id)
    .eq("provider", "stripe")
    .eq("status", "active")
    .maybeSingle();

  if (!customer.data?.provider_customer_id) {
    return errorResponse("NOT_FOUND", "No billing customer exists for this account yet.", 404);
  }

  const params = new URLSearchParams();
  params.set("customer", customer.data.provider_customer_id);
  params.set("return_url", returnUrl);
  const portal = await stripeRequest(stripe, "POST", "billing_portal/sessions", params);
  if (!portal.ok || typeof portal.data.url !== "string" || !isAllowedPortalHost(portal.data.url)) {
    return errorResponse("UNAVAILABLE", "Unable to create a secure billing portal session.", 502);
  }

  return jsonResponse({ data: { portalUrl: portal.data.url, provider: "stripe" } });
});
