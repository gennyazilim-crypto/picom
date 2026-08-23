import { errorResponse, jsonResponse, methodNotAllowed } from "../_shared/http.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createAccountOnboardingLink,
  createAccountUpdateLink,
  createConnectedAccount,
  readPayoutProviderConfig,
} from "../_shared/payout-provider.ts";

function isAllowlistedUrl(url: string, allowlist: readonly string[]): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    return allowlist.some((origin) => {
      try {
        const allowed = new URL(origin);
        return allowed.origin === parsed.origin;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return methodNotAllowed(["POST"]);

  const config = readPayoutProviderConfig();
  if (!config) {
    return errorResponse("PAYOUT_PROVIDER_NOT_CONFIGURED", "Payout provider secrets are not configured. Onboarding is fail-closed.", 503);
  }

  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return errorResponse("UNAUTHORIZED", "Authorization required.", 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return errorResponse("NOT_CONFIGURED", "Supabase is not configured.", 503);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return errorResponse("UNAUTHORIZED", "Invalid session.", 401);

  let body: { payout_profile_id?: string; mode?: string };
  try {
    body = await request.json();
  } catch {
    return errorResponse("VALIDATION_ERROR", "JSON body required.", 400);
  }

  const profileId = body.payout_profile_id?.trim();
  const mode = body.mode === "update" ? "update" : "onboarding";
  if (!profileId) return errorResponse("VALIDATION_ERROR", "payout_profile_id is required.", 400);

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: profile, error: profileError } = await admin
    .from("payout_profiles")
    .select("id,owner_id,provider_account_id,country_code,payout_currency,onboarding_status")
    .eq("id", profileId)
    .maybeSingle();

  if (profileError || !profile) return errorResponse("NOT_FOUND", "Payout profile not found.", 404);
  if (profile.owner_id !== userData.user.id) return errorResponse("FORBIDDEN", "Not your payout profile.", 403);

  if (!isAllowlistedUrl(config.returnUrl, [config.returnUrl]) || !isAllowlistedUrl(config.refreshUrl, [config.refreshUrl])) {
    return errorResponse("VALIDATION_ERROR", "Onboarding return/refresh URLs must be HTTPS allowlisted.", 400);
  }

  let accountId = typeof profile.provider_account_id === "string" ? profile.provider_account_id : null;
  if (!accountId) {
    const created = await createConnectedAccount(config, {
      country: String(profile.country_code ?? "US"),
      currency: String(profile.payout_currency ?? "USD"),
      email: userData.user.email ?? undefined,
      idempotencyKey: `payout-account:${profileId}`,
    });
    if (!created.ok) return errorResponse(created.code, created.message, 502);
    accountId = created.accountId;
    await admin.from("payout_profiles").update({
      provider_account_id: accountId,
      onboarding_status: "pending",
      updated_at: new Date().toISOString(),
    }).eq("id", profileId);
  }

  const link = mode === "update"
    ? await createAccountUpdateLink(config, accountId)
    : await createAccountOnboardingLink(config, accountId);

  if (!link.ok) return errorResponse(link.code, link.message, 502);
  if (!isAllowlistedUrl(link.url, ["https://connect.stripe.com", "https://checkout.stripe.com", config.returnUrl])) {
    // Provider-hosted onboarding hosts only.
    try {
      const host = new URL(link.url).hostname;
      if (!host.endsWith("stripe.com")) {
        return errorResponse("PROVIDER_URL_REJECTED", "Onboarding URL host is not allowlisted.", 502);
      }
    } catch {
      return errorResponse("PROVIDER_URL_REJECTED", "Onboarding URL is invalid.", 502);
    }
  }

  return jsonResponse({
    url: link.url,
    provider_ready: true,
    mode,
    note: "Callback refresh only; completion requires provider account retrieve + webhook.",
  });
});
