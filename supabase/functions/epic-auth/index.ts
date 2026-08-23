// Custom Epic Games sign-in for Picom. Supabase Auth has no native Epic provider, so
// this function runs the Epic Account Services OAuth2 flow, then mints a Supabase
// session the initiating client polls for. Disabled unless SUPABASE_SERVICE_ROLE_KEY,
// EPIC_CLIENT_ID, EPIC_CLIENT_SECRET and EPIC_DEPLOYMENT_ID are configured.
//
// Link mode mirrors steam-auth: authenticated start-link → browser OAuth → bind
// Epic account id to auth.uid() without silent email merge.

import {
  completeHandoff,
  consumeHandoff,
  consumeSocialAuthRateLimit,
  createPendingHandoff,
  getPendingHandoff,
  getServiceClient,
  isValidNonce,
  linkIdentityToUser,
  mintSessionForIdentity,
  resolveCallerUserId,
  unlinkIdentityFromUser,
} from "../_shared/social-auth-session.ts";

const EPIC_AUTHORIZE_ENDPOINT = "https://www.epicgames.com/id/authorize";
const EPIC_TOKEN_ENDPOINT = "https://api.epicgames.dev/epic/oauth/v2/token";
const EPIC_ACCOUNTS_ENDPOINT = "https://api.epicgames.dev/epic/id/v2/accounts";

/** Browser Account Center + marketing/app must be able to call start-link (never wildcards). */
const DEFAULT_ALLOWED_ORIGINS = [
  "https://account.picom.gg",
  "https://picom.gg",
  "https://www.picom.gg",
  "https://app.picom.gg",
  "http://127.0.0.1:5173",
  "http://localhost:5173",
];

function corsHeaders(origin: string | null): HeadersInit {
  const fromEnv = (Deno.env.get("PICOM_ALLOWED_ORIGINS") ?? "").split(",").map((v) => v.trim()).filter(Boolean);
  const allow = new Set([...DEFAULT_ALLOWED_ORIGINS, ...fromEnv]);
  return {
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Cache-Control": "no-store",
    ...(origin && allow.has(origin) ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
  };
}

function functionBaseUrl(): string {
  // Browser-facing Epic redirect_uri must be branded auth.picom.gg gateway callback.
  const configured = Deno.env.get("EPIC_REDIRECT_URI")?.trim().replace(/\/+$/, "");
  if (configured) {
    try {
      const host = new URL(configured).hostname.toLowerCase();
      if (host === "auth.picom.gg" && !/supabase\.(co|in)/i.test(configured)) {
        return configured;
      }
    } catch {
      // fall through to canonical
    }
  }
  return "https://auth.picom.gg/epic/callback";
}

function epicBrowserStartUrl(nonce: string): string {
  const publicBase = (Deno.env.get("AUTH_GATEWAY_PUBLIC_URL") ?? "https://auth.picom.gg").trim().replace(/\/+$/, "");
  try {
    const host = new URL(publicBase).hostname.toLowerCase();
    if (host !== "auth.picom.gg" || /supabase\.(co|in)/i.test(publicBase)) {
      return `https://auth.picom.gg/epic/start?nonce=${encodeURIComponent(nonce)}`;
    }
  } catch {
    return `https://auth.picom.gg/epic/start?nonce=${encodeURIComponent(nonce)}`;
  }
  return `${publicBase}/epic/start?nonce=${encodeURIComponent(nonce)}`;
}

function returnPage(message: string): Response {
  return new Response(
    `<!doctype html><meta charset=utf-8><title>Picom</title><body style="font-family:system-ui;text-align:center;padding:48px"><h2>${message}</h2><p>You can close this window and return to Picom.</p></body>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );
}

function json(body: unknown, status = 200, origin: string | null = null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
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
  if (!client) return json({ code: "NOT_CONFIGURED", message: "Epic sign-in is not configured." }, 503, origin);

  if (action === "start-link" && request.method === "POST") {
    if (!isValidNonce(nonce)) return json({ code: "INVALID_NONCE" }, 400, origin);
    const userId = await resolveCallerUserId(request, client);
    if (!userId) return json({ code: "UNAUTHORIZED" }, 401, origin);
    const clientId = Deno.env.get("EPIC_CLIENT_ID");
    const clientSecret = Deno.env.get("EPIC_CLIENT_SECRET");
    const deploymentId = Deno.env.get("EPIC_DEPLOYMENT_ID");
    if (!clientId || !clientSecret || !deploymentId) return json({ code: "NOT_CONFIGURED" }, 503, origin);
    const rateLimit = await consumeSocialAuthRateLimit(client, request, "epic");
    if (!rateLimit) return json({ code: "UNAVAILABLE" }, 503, origin);
    if (!rateLimit.allowed) return json({ code: "RATE_LIMITED" }, 429, origin);
    if (!(await createPendingHandoff(client, nonce, "epic", { purpose: "link", linkUserId: userId }))) {
      return json({ code: "HANDOFF_FAILED" }, 500, origin);
    }
    return json({ ok: true, loginUrl: epicBrowserStartUrl(nonce) }, 200, origin);
  }

  if (action === "unlink" && request.method === "POST") {
    const userId = await resolveCallerUserId(request, client);
    if (!userId) return json({ code: "UNAUTHORIZED" }, 401, origin);
    const result = await unlinkIdentityFromUser(client, "epic", userId);
    if (!result.ok) return json({ code: result.code }, result.code === "last_method" ? 409 : 400, origin);
    return json({ ok: true }, 200, origin);
  }

  if (action === "login") {
    // Ignore client-supplied redirect_uri / realm overrides — Epic redirect is server-canonical only.
    url.searchParams.delete("redirect_uri");
    url.searchParams.delete("realm");
    url.searchParams.delete("return_to");
    const clientId = Deno.env.get("EPIC_CLIENT_ID");
    const clientSecret = Deno.env.get("EPIC_CLIENT_SECRET");
    const deploymentId = Deno.env.get("EPIC_DEPLOYMENT_ID");
    if (!isValidNonce(nonce) || !clientId || !clientSecret || !deploymentId) {
      return new Response("Invalid request.", { status: 400, headers: corsHeaders(origin) });
    }
    const existing = await getPendingHandoff(client, nonce, "epic");
    if (!existing) {
      const rateLimit = await consumeSocialAuthRateLimit(client, request, "epic");
      if (!rateLimit) return new Response("Epic sign-in is temporarily unavailable.", { status: 503, headers: { ...corsHeaders(origin), "Retry-After": "30" } });
      if (!rateLimit.allowed) return new Response("Too many sign-in attempts.", { status: 429, headers: { ...corsHeaders(origin), "Retry-After": String(rateLimit.retryAfterSeconds) } });
      if (!(await createPendingHandoff(client, nonce, "epic"))) return new Response("Could not start sign-in.", { status: 500, headers: corsHeaders(origin) });
    }
    const redirectUri = functionBaseUrl();
    const authorize = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      scope: "basic_profile",
      redirect_uri: redirectUri,
      state: nonce,
    });
    return new Response(null, {
      status: 302,
      headers: { Location: `${EPIC_AUTHORIZE_ENDPOINT}?${authorize.toString()}`, "Cache-Control": "no-store" },
    });
  }

  if (action === "callback") {
    const code = url.searchParams.get("code") ?? "";
    if (!isValidNonce(nonce) || !code) return new Response("Invalid request.", { status: 400 });
    const pending = await getPendingHandoff(client, nonce, "epic");
    if (!pending) return new Response("Epic sign-in request expired.", { status: 410 });
    const redirectUri = functionBaseUrl();
    const exchanged = await exchangeEpicCode(code, redirectUri);
    if (!exchanged.ok) {
      console.error("Epic OAuth token exchange failed", { reason: exchanged.reason });
      return new Response("Epic verification failed.", { status: 401 });
    }
    const displayName = await fetchEpicDisplayName(exchanged.accountId, exchanged.accessToken);
    const identityInput = {
      provider: "epic" as const,
      externalId: exchanged.accountId,
      metadata: { provider: "epic", epic_account_id: exchanged.accountId, full_name: displayName, display_name: displayName },
    };

    if (pending.purpose === "link") {
      if (!pending.link_user_id) return new Response("Epic link request invalid.", { status: 400 });
      const linked = await linkIdentityToUser(client, identityInput, pending.link_user_id);
      if (!linked.ok) {
        await client.from("account_security_events").insert({
          user_id: pending.link_user_id,
          event_type: "provider_link_failed",
          metadata: { provider: "epic", code: linked.code },
        });
        await client.from("social_auth_handoffs").delete().eq("nonce", nonce);
        return returnPage("Epic could not be linked to this Picom account.");
      }
      try {
        if (!(await completeHandoff(client, nonce, "epic", { access_token: "linked", refresh_token: "linked" }))) {
          return new Response("Could not finalize Epic link.", { status: 500 });
        }
      } catch {
        return new Response("Could not finalize Epic link.", { status: 500 });
      }
      return returnPage("Epic is connected to your Picom account.");
    }

    const session = await mintSessionForIdentity(client, identityInput);
    if (!session) return new Response("Could not create Picom session.", { status: 500 });
    try {
      if (!(await completeHandoff(client, nonce, "epic", session))) return new Response("Could not finalize Epic sign-in.", { status: 500 });
    } catch (error) {
      const reason = error instanceof Error ? error.message.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 120) : "SOCIAL_HANDOFF_UPDATE_unknown";
      console.error("Epic OAuth handoff completion failed", { reason });
      return new Response("Could not finalize Epic sign-in.", { status: 500 });
    }
    return returnPage("You're signed in with Epic.");
  }

  if (action === "poll" || action === "exchange") {
    if (!isValidNonce(nonce)) return json({ status: "unknown" }, 400, origin);
    const result = await consumeHandoff(client, nonce);
    const linked = result.session?.access_token === "linked" && result.session?.refresh_token === "linked";
    if (result.status === "ready" && linked) {
      return json({ status: "ready", linked: true, session: null }, 200, origin);
    }
    return json(result, 200, origin);
  }

  return new Response("Not found.", { status: 404, headers: corsHeaders(origin) });
});
