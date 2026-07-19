// Custom Epic Games sign-in for Picom. Supabase Auth has no native Epic provider, so
// this function runs the Epic Account Services OAuth2 flow, then mints a Supabase
// session the initiating client polls for. Disabled unless SUPABASE_SERVICE_ROLE_KEY,
// EPIC_CLIENT_ID, EPIC_CLIENT_SECRET and EPIC_DEPLOYMENT_ID are configured.
//
// !!! SECURITY REVIEW REQUIRED before deploy/enable. This mints Supabase sessions from
// an external identity; a flaw here is an authentication bypass. Not deployed by the
// author (environment cannot deploy). Verify the current Epic OAuth endpoints against
// Epic's developer docs before deploying — they are versioned.

import { completeHandoff, consumeHandoff, consumeSocialAuthRateLimit, createPendingHandoff, getServiceClient, isPendingHandoff, isValidNonce, mintSessionForIdentity } from "../_shared/social-auth-session.ts";

const EPIC_AUTHORIZE_ENDPOINT = "https://www.epicgames.com/id/authorize";
const EPIC_TOKEN_ENDPOINT = "https://api.epicgames.dev/epic/oauth/v2/token";
const EPIC_ACCOUNTS_ENDPOINT = "https://api.epicgames.dev/epic/id/v2/accounts";

function corsHeaders(origin: string | null): HeadersInit {
  const allow = (Deno.env.get("PICOM_ALLOWED_ORIGINS") ?? "").split(",").map((v) => v.trim()).filter(Boolean);
  return {
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Cache-Control": "no-store",
    ...(origin && allow.includes(origin) ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
  };
}

function functionBaseUrl(): string {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim().replace(/\/+$/, "");
  return supabaseUrl ? `${supabaseUrl}/functions/v1/epic-auth` : "";
}

function returnPage(): Response {
  return new Response(
    "<!doctype html><meta charset=utf-8><title>Picom</title><body style=\"font-family:system-ui;text-align:center;padding:48px\"><h2>You're signed in with Epic.</h2><p>You can close this window and return to Picom.</p></body>",
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );
}

type EpicCodeExchangeResult =
  | { ok: true; accountId: string; accessToken: string }
  | { ok: false; reason: string };

async function exchangeEpicCode(code: string, redirectUri: string): Promise<EpicCodeExchangeResult> {
  const clientId = Deno.env.get("EPIC_CLIENT_ID");
  const clientSecret = Deno.env.get("EPIC_CLIENT_SECRET");
  const deploymentId = Deno.env.get("EPIC_DEPLOYMENT_ID");
  if (!clientId || !clientSecret || !deploymentId) return { ok: false, reason: "configuration_missing" };
  const basic = btoa(`${clientId}:${clientSecret}`);
  const response = await fetch(EPIC_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${basic}` },
    body: new URLSearchParams({ grant_type: "authorization_code", code, deployment_id: deploymentId, redirect_uri: redirectUri }).toString(),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const providerCode = typeof data?.errorCode === "string"
      ? data.errorCode.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 120)
      : "unknown";
    return { ok: false, reason: `token_http_${response.status}_${providerCode}` };
  }
  if (!data?.account_id || !data?.access_token) {
    return { ok: false, reason: `token_response_invalid_account_${Boolean(data?.account_id)}_token_${Boolean(data?.access_token)}` };
  }
  return { ok: true, accountId: String(data.account_id), accessToken: String(data.access_token) };
}

async function fetchEpicDisplayName(accountId: string, accessToken: string): Promise<string> {
  try {
    const response = await fetch(`${EPIC_ACCOUNTS_ENDPOINT}?accountId=${encodeURIComponent(accountId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await response.json().catch(() => null);
    const name = Array.isArray(data) ? data[0]?.displayName : data?.displayName;
    return (typeof name === "string" && name.trim() ? name : `Epic ${accountId.slice(-4)}`).slice(0, 80);
  } catch {
    return `Epic ${accountId.slice(-4)}`;
  }
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("Origin");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });

  const url = new URL(request.url);
  const action = url.searchParams.get("action") ?? (url.searchParams.has("code") ? "callback" : null);
  const nonce = url.searchParams.get("nonce") ?? url.searchParams.get("state") ?? "";
  const client = getServiceClient();
  if (!client) return new Response(JSON.stringify({ code: "NOT_CONFIGURED", message: "Epic sign-in is not configured." }), { status: 503, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } });

  // 1) Begin: register the pending handoff and redirect the user to Epic.
  if (action === "login") {
    const clientId = Deno.env.get("EPIC_CLIENT_ID");
    const clientSecret = Deno.env.get("EPIC_CLIENT_SECRET");
    const deploymentId = Deno.env.get("EPIC_DEPLOYMENT_ID");
    if (!isValidNonce(nonce) || !clientId || !clientSecret || !deploymentId) return new Response("Invalid request.", { status: 400, headers: corsHeaders(origin) });
    const rateLimit = await consumeSocialAuthRateLimit(client, request, "epic");
    if (!rateLimit) return new Response("Epic sign-in is temporarily unavailable.", { status: 503, headers: { ...corsHeaders(origin), "Retry-After": "30" } });
    if (!rateLimit.allowed) return new Response("Too many sign-in attempts.", { status: 429, headers: { ...corsHeaders(origin), "Retry-After": String(rateLimit.retryAfterSeconds) } });
    if (!(await createPendingHandoff(client, nonce, "epic"))) return new Response("Could not start sign-in.", { status: 500, headers: corsHeaders(origin) });
    const redirectUri = functionBaseUrl();
    const authorize = new URLSearchParams({ client_id: clientId, response_type: "code", scope: "basic_profile", redirect_uri: redirectUri, state: nonce });
    return new Response(null, { status: 302, headers: { Location: `${EPIC_AUTHORIZE_ENDPOINT}?${authorize.toString()}`, "Cache-Control": "no-store" } });
  }

  // 2) Callback from Epic: exchange the code, resolve identity, mint the session.
  if (action === "callback") {
    const code = url.searchParams.get("code") ?? "";
    if (!isValidNonce(nonce) || !code) return new Response("Invalid request.", { status: 400 });
    if (!(await isPendingHandoff(client, nonce, "epic"))) return new Response("Epic sign-in request expired.", { status: 410 });
    const redirectUri = functionBaseUrl();
    const exchanged = await exchangeEpicCode(code, redirectUri);
    if (!exchanged.ok) {
      console.error("Epic OAuth token exchange failed", { reason: exchanged.reason });
      return new Response("Epic verification failed.", { status: 401 });
    }
    const displayName = await fetchEpicDisplayName(exchanged.accountId, exchanged.accessToken);
    const session = await mintSessionForIdentity(client, {
      email: `epic_${exchanged.accountId}@epic.users.picom.local`,
      metadata: { provider: "epic", epic_account_id: exchanged.accountId, full_name: displayName, display_name: displayName },
    });
    if (!session) return new Response("Could not create Picom session.", { status: 500 });
    try {
      if (!(await completeHandoff(client, nonce, "epic", session))) return new Response("Could not finalize Epic sign-in.", { status: 500 });
    } catch (error) {
      const reason = error instanceof Error ? error.message.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 120) : "SOCIAL_HANDOFF_UPDATE_unknown";
      console.error("Epic OAuth handoff completion failed", { reason });
      return new Response("Could not finalize Epic sign-in.", { status: 500 });
    }
    return returnPage();
  }

  // 3) Poll: the client exchanges its nonce for the minted session exactly once.
  if (action === "poll") {
    if (!isValidNonce(nonce)) return new Response(JSON.stringify({ status: "unknown" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } });
    const result = await consumeHandoff(client, nonce);
    return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } });
  }

  return new Response("Not found.", { status: 404, headers: corsHeaders(origin) });
});
