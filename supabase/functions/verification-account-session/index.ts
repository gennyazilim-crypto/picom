import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireSupabaseUser } from "../_shared/supabase-auth.ts";
import { errorResponse, jsonResponse, methodNotAllowed } from "../_shared/http.ts";
import { buildAbsoluteReturnUrl } from "../_shared/billing-allowlist.ts";
import { readStripeConfig, stripeRequest } from "../_shared/billing-stripe.ts";

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return jsonResponse({ ok: true });
  if (request.method !== "POST") return methodNotAllowed(["POST"]);

  const auth = await requireSupabaseUser(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const returnPath = typeof body?.returnPath === "string" ? body.returnPath : "/account/verification";
  const returnUrl = buildAbsoluteReturnUrl(returnPath);
  if (!returnUrl) return errorResponse("VALIDATION_ERROR", "Return URL must use an allowlisted Account Center path.", 400);

  const serviceUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceUrl || !serviceKey) return errorResponse("NOT_CONFIGURED", "Supabase service role is not configured.", 503);
  const admin = createClient(serviceUrl, serviceKey, { auth: { persistSession: false } });

  const userSummary = await auth.supabase.rpc("get_picom_verified_summary");
  if (userSummary.error) {
    return errorResponse("UNAVAILABLE", "Unable to load PICOM Verified summary.", 500);
  }
  const entitlements = (userSummary.data as { entitlements?: { verifiedBadgeEligible?: boolean } } | null)?.entitlements;
  if (!entitlements?.verifiedBadgeEligible) {
    return errorResponse("FORBIDDEN", "An active PICOM Verified subscription is required before account verification.", 403);
  }

  const openSession = await admin
    .from("account_verification_sessions")
    .select("id,status,provider_session_id")
    .eq("user_id", auth.user.id)
    .in("status", ["pending", "requires_input", "processing"])
    .maybeSingle();
  if (openSession.data) {
    return jsonResponse({
      data: {
        sessionUrl: null,
        status: openSession.data.status,
        provider: "stripe_identity",
        message: "An open verification session already exists.",
      },
    });
  }

  const stripe = readStripeConfig();
  if (!stripe) {
    const caseInsert = await admin.from("verification_cases").insert({
      subject_type: "user",
      subject_id: auth.user.id,
      verification_type: "picom_verified_account",
      status: "pending",
      provider: "manual_review",
      submitted_at: new Date().toISOString(),
      metadata: { reason: "provider_not_configured" },
    }).select("id").single();
    if (caseInsert.error || !caseInsert.data) {
      return errorResponse("NOT_CONFIGURED", "Verification provider is not configured.", 503);
    }
    await admin.from("account_verification_sessions").insert({
      user_id: auth.user.id,
      verification_case_id: caseInsert.data.id,
      provider: "manual_review",
      status: "pending",
      return_url: returnUrl,
    });
    return errorResponse("NOT_CONFIGURED", "Identity verification provider credentials are not configured.", 503);
  }

  const caseInsert = await admin.from("verification_cases").insert({
    subject_type: "user",
    subject_id: auth.user.id,
    verification_type: "picom_verified_account",
    status: "pending",
    provider: "stripe_identity",
    submitted_at: new Date().toISOString(),
    metadata: {},
  }).select("id").single();
  if (caseInsert.error || !caseInsert.data) {
    return errorResponse("UNAVAILABLE", "Unable to create verification case.", 500);
  }

  const params = new URLSearchParams();
  params.set("type", "document");
  params.set("metadata[picom_user_id]", auth.user.id);
  params.set("return_url", returnUrl);
  const session = await stripeRequest(stripe, "POST", "identity/verification_sessions", params);
  if (!session.ok || typeof session.data.id !== "string") {
    return errorResponse("UNAVAILABLE", "Unable to create identity verification session.", 502);
  }

  await admin.from("account_verification_sessions").insert({
    user_id: auth.user.id,
    verification_case_id: caseInsert.data.id,
    provider: "stripe_identity",
    provider_session_id: session.data.id,
    status: "pending",
    return_url: returnUrl,
  });

  const url = typeof session.data.url === "string" ? session.data.url : null;
  return jsonResponse({
    data: {
      sessionUrl: url,
      status: "pending",
      provider: "stripe_identity",
    },
  });
});
