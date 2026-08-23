// Custom Steam sign-in for Picom. Supabase Auth has no native Steam provider and
// Steam uses OpenID 2.0 (not OAuth2/OIDC), so this function runs the Steam OpenID
// dance, verifies the assertion with Steam, and mints a Supabase session that the
// initiating client polls for. Disabled unless SUPABASE_SERVICE_ROLE_KEY and
// STEAM_WEB_API_KEY are configured.
//
// Link mode: an authenticated client POSTs action=start-link (Bearer JWT + nonce),
 // then opens action=login with the same nonce. Callback binds the SteamID to that
// user without silent email merge. Unlink requires Bearer JWT and last-method guard.

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

const STEAM_OPENID_ENDPOINT = "https://steamcommunity.com/openid/login";
const steamIdPattern = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/;
const CANONICAL_STEAM_REALM = "https://auth.picom.gg/";
/** Branded auth-gateway callback path (Steam consent + browser never see supabase.co). */
const CANONICAL_STEAM_RETURN = "https://auth.picom.gg/steam/callback";

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

/** Public branded gateway origin for client redirects (never supabase.co). */
function authGatewayBaseUrl(): string {
  const configured = Deno.env.get("AUTH_GATEWAY_PUBLIC_URL")?.trim().replace(/\/+$/, "");
  return configured || "https://auth.picom.gg";
}

function steamOpenIdRealm(): string {
  const configured = Deno.env.get("STEAM_OPENID_REALM")?.trim();
  const realm = configured || CANONICAL_STEAM_REALM;
  // Refuse infrastructure hosts even if misconfigured in secrets.
  try {
    const host = new URL(realm).hostname.toLowerCase();
    if (host !== "auth.picom.gg" || /supabase\.co/i.test(realm)) return CANONICAL_STEAM_REALM;
  } catch {
    return CANONICAL_STEAM_REALM;
  }
  return realm.endsWith("/") ? realm : `${realm}/`;
}

function steamOpenIdReturnBase(): string {
  const configured = Deno.env.get("STEAM_OPENID_RETURN_URL")?.trim().replace(/\/+$/, "");
  const value = configured || CANONICAL_STEAM_RETURN;
  try {
    const host = new URL(value).hostname.toLowerCase();
    if (host !== "auth.picom.gg" || /supabase\.co/i.test(value)) return CANONICAL_STEAM_RETURN;
  } catch {
    return CANONICAL_STEAM_RETURN;
  }
  return value;
}

function expectedSteamReturnTo(nonce: string): string {
  return `${steamOpenIdReturnBase()}?nonce=${encodeURIComponent(nonce)}`;
}

function normalizeSteamOpenIdReturnTo(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:" || parsed.hostname.toLowerCase() !== "auth.picom.gg") return null;
    const path = parsed.pathname.replace(/\/+$/, "") || "/";
    if (path !== "/steam/callback") return null;
    const handoffNonce = parsed.searchParams.get("nonce") ?? "";
    if (!isValidNonce(handoffNonce)) return null;
    return expectedSteamReturnTo(handoffNonce);
  } catch {
    return null;
  }
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

async function verifySteamAssertion(params: URLSearchParams): Promise<boolean> {
  // Steam check_authentication must receive only openid.* fields. Extra query
  // keys (action, nonce) forwarded by auth.picom.gg can make Steam return is_valid:false.
  const body = new URLSearchParams();
  for (const [key, value] of params.entries()) {
    if (key.startsWith("openid.")) body.set(key, value);
  }
  body.set("openid.mode", "check_authentication");
  if (!body.get("openid.sig") || !body.get("openid.signed")) return false;
  const response = await fetch(STEAM_OPENID_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const text = await response.text();
  return /is_valid\s*:\s*true/.test(text);
}

async function fetchSteamProfile(steamId: string): Promise<{ name: string; avatar?: string }> {
  const apiKey = Deno.env.get("STEAM_WEB_API_KEY");
  if (!apiKey) return { name: `Steam ${steamId.slice(-4)}` };
  try {
    const response = await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${apiKey}&steamids=${steamId}`);
    const data = await response.json();
    const player = data?.response?.players?.[0];
    return { name: (player?.personaname ?? `Steam ${steamId.slice(-4)}`).slice(0, 80), avatar: typeof player?.avatarfull === "string" ? player.avatarfull : undefined };
  } catch {
    return { name: `Steam ${steamId.slice(-4)}` };
  }
}

async function redirectToSteam(nonce: string): Promise<Response> {
  // Never use raw Supabase URL as OpenID realm/return_to — Steam consent would show it.
  // Client-supplied realm/return_to query params are ignored; only server env/canonical values apply.
  const returnTo = expectedSteamReturnTo(nonce);
  const realm = steamOpenIdRealm();
  const openid = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": returnTo,
    "openid.realm": realm,
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
  });
  return new Response(null, {
    status: 302,
    headers: { Location: `${STEAM_OPENID_ENDPOINT}?${openid.toString()}`, "Cache-Control": "no-store" },
  });
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("Origin");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });

  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  const nonce = url.searchParams.get("nonce") ?? "";
  const client = getServiceClient();
  if (!client) return json({ code: "NOT_CONFIGURED", message: "Steam sign-in is not configured." }, 503, origin);

  // Authenticated: register a link handoff bound to the caller's auth.uid().
  if (action === "start-link" && request.method === "POST") {
    if (!isValidNonce(nonce)) return json({ code: "INVALID_NONCE" }, 400, origin);
    const userId = await resolveCallerUserId(request, client);
    if (!userId) return json({ code: "UNAUTHORIZED" }, 401, origin);
    const rateLimit = await consumeSocialAuthRateLimit(client, request, "steam");
    if (!rateLimit) return json({ code: "UNAVAILABLE" }, 503, origin);
    if (!rateLimit.allowed) return json({ code: "RATE_LIMITED" }, 429, origin);
    if (!(await createPendingHandoff(client, nonce, "steam", { purpose: "link", linkUserId: userId }))) {
      return json({ code: "HANDOFF_FAILED" }, 500, origin);
    }
    return json({ ok: true, loginUrl: `${authGatewayBaseUrl()}/steam/start?nonce=${encodeURIComponent(nonce)}` }, 200, origin);
  }

  if (action === "unlink" && request.method === "POST") {
    const userId = await resolveCallerUserId(request, client);
    if (!userId) return json({ code: "UNAUTHORIZED" }, 401, origin);
    const result = await unlinkIdentityFromUser(client, "steam", userId);
    if (!result.ok) return json({ code: result.code }, result.code === "last_method" ? 409 : 400, origin);
    return json({ ok: true }, 200, origin);
  }

  // Begin login or continue a pre-registered link handoff, then redirect to Steam.
  if (action === "login") {
    // Ignore any client-supplied realm/return_to — OpenID values are server-canonical only.
    url.searchParams.delete("realm");
    url.searchParams.delete("return_to");
    url.searchParams.delete("openid.realm");
    url.searchParams.delete("openid.return_to");
    if (!isValidNonce(nonce)) return new Response("Invalid request.", { status: 400, headers: corsHeaders(origin) });
    const existing = await getPendingHandoff(client, nonce, "steam");
    if (!existing) {
      const rateLimit = await consumeSocialAuthRateLimit(client, request, "steam");
      if (!rateLimit) return new Response("Steam sign-in is temporarily unavailable.", { status: 503, headers: { ...corsHeaders(origin), "Retry-After": "30" } });
      if (!rateLimit.allowed) return new Response("Too many sign-in attempts.", { status: 429, headers: { ...corsHeaders(origin), "Retry-After": String(rateLimit.retryAfterSeconds) } });
      if (!(await createPendingHandoff(client, nonce, "steam"))) return new Response("Could not start sign-in.", { status: 500, headers: corsHeaders(origin) });
    }
    return redirectToSteam(nonce);
  }

  if (action === "callback") {
    if (!isValidNonce(nonce)) return new Response("Invalid request.", { status: 400 });
    const pending = await getPendingHandoff(client, nonce, "steam");
    if (!pending) return new Response("Steam sign-in request expired.", { status: 410 });
    const expectedReturnTo = expectedSteamReturnTo(nonce);
    const signedFields = new Set((url.searchParams.get("openid.signed") ?? "").split(","));
    const claimedId = url.searchParams.get("openid.claimed_id") ?? "";
    const identity = url.searchParams.get("openid.identity") ?? "";
    const returnToNormalized = normalizeSteamOpenIdReturnTo(url.searchParams.get("openid.return_to") ?? "");
    const validEnvelope = url.searchParams.get("openid.ns") === "http://specs.openid.net/auth/2.0"
      && url.searchParams.get("openid.mode") === "id_res"
      && url.searchParams.get("openid.op_endpoint") === STEAM_OPENID_ENDPOINT
      && returnToNormalized === normalizeSteamOpenIdReturnTo(expectedReturnTo)
      && identity === claimedId
      && ["claimed_id", "identity", "return_to", "response_nonce", "assoc_handle"].every((field) => signedFields.has(field));
    const match = steamIdPattern.exec(claimedId);
    if (!validEnvelope || !match || !(await verifySteamAssertion(url.searchParams))) {
      return new Response("Steam verification failed.", { status: 401 });
    }
    const steamId = match[1];
    const profile = await fetchSteamProfile(steamId);
    const identityInput = {
      provider: "steam" as const,
      externalId: steamId,
      metadata: { provider: "steam", steam_id: steamId, full_name: profile.name, display_name: profile.name, avatar_url: profile.avatar },
    };

    if (pending.purpose === "link") {
      if (!pending.link_user_id) return new Response("Steam link request invalid.", { status: 400 });
      const linked = await linkIdentityToUser(client, identityInput, pending.link_user_id);
      if (!linked.ok) {
        await client.from("account_security_events").insert({
          user_id: pending.link_user_id,
          event_type: "provider_link_failed",
          metadata: { provider: "steam", code: linked.code },
        });
        await client.from("social_auth_handoffs").delete().eq("nonce", nonce);
        return returnPage("Steam could not be linked to this Picom account.");
      }
      try {
        if (!(await completeHandoff(client, nonce, "steam", { access_token: "linked", refresh_token: "linked" }))) {
          return new Response("Could not complete Steam link.", { status: 500 });
        }
      } catch {
        return new Response("Could not complete Steam link.", { status: 500 });
      }
      return returnPage("Steam is connected to your Picom account.");
    }

    const session = await mintSessionForIdentity(client, identityInput);
    if (!session) return new Response("Could not complete Steam sign-in.", { status: 500 });
    try {
      if (!(await completeHandoff(client, nonce, "steam", session))) return new Response("Could not complete Steam sign-in.", { status: 500 });
    } catch {
      return new Response("Could not complete Steam sign-in.", { status: 500 });
    }
    return returnPage("You're signed in with Steam.");
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
