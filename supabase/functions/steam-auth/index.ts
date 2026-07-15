// Custom Steam sign-in for Picom. Supabase Auth has no native Steam provider and
// Steam uses OpenID 2.0 (not OAuth2/OIDC), so this function runs the Steam OpenID
// dance, verifies the assertion with Steam, and mints a Supabase session that the
// initiating client polls for. Disabled unless SUPABASE_SERVICE_ROLE_KEY and
// STEAM_WEB_API_KEY are configured.
//
// !!! SECURITY REVIEW REQUIRED before deploy/enable. This mints Supabase sessions
// from an external identity; a flaw here is an authentication bypass. Not deployed
// by the author (environment cannot deploy); operator + security review must gate it.

import { getServiceClient, isValidNonce, mintSessionForIdentity, createPendingHandoff, completeHandoff, consumeHandoff } from "../_shared/social-auth-session.ts";

const STEAM_OPENID_ENDPOINT = "https://steamcommunity.com/openid/login";
const steamIdPattern = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/;

function corsHeaders(origin: string | null): HeadersInit {
  const allow = (Deno.env.get("PICOM_ALLOWED_ORIGINS") ?? "").split(",").map((v) => v.trim()).filter(Boolean);
  return {
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Cache-Control": "no-store",
    ...(origin && allow.includes(origin) ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
  };
}

function functionBaseUrl(request: Request): string {
  const url = new URL(request.url);
  // Strip any trailing path so we always target this function's root.
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

function returnPage(): Response {
  return new Response(
    "<!doctype html><meta charset=utf-8><title>Picom</title><body style=\"font-family:system-ui;text-align:center;padding:48px\"><h2>You're signed in with Steam.</h2><p>You can close this window and return to Picom.</p></body>",
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );
}

async function verifySteamAssertion(params: URLSearchParams): Promise<boolean> {
  const body = new URLSearchParams(params);
  body.set("openid.mode", "check_authentication");
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

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("Origin");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });

  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  const nonce = url.searchParams.get("nonce") ?? "";
  const client = getServiceClient();
  if (!client) return new Response(JSON.stringify({ code: "NOT_CONFIGURED", message: "Steam sign-in is not configured." }), { status: 503, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } });

  // 1) Begin: register the pending handoff and redirect the user to Steam.
  if (action === "login") {
    if (!isValidNonce(nonce)) return new Response("Invalid request.", { status: 400, headers: corsHeaders(origin) });
    if (!(await createPendingHandoff(client, nonce, "steam"))) return new Response("Could not start sign-in.", { status: 500, headers: corsHeaders(origin) });
    const base = functionBaseUrl(request);
    const returnTo = `${base}?action=callback&nonce=${encodeURIComponent(nonce)}`;
    const openid = new URLSearchParams({
      "openid.ns": "http://specs.openid.net/auth/2.0",
      "openid.mode": "checkid_setup",
      "openid.return_to": returnTo,
      "openid.realm": base,
      "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
      "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
    });
    return new Response(null, { status: 302, headers: { Location: `${STEAM_OPENID_ENDPOINT}?${openid.toString()}`, "Cache-Control": "no-store" } });
  }

  // 2) Callback from Steam: verify, resolve identity, mint the session, park it.
  if (action === "callback") {
    if (!isValidNonce(nonce)) return new Response("Invalid request.", { status: 400 });
    const claimedId = url.searchParams.get("openid.claimed_id") ?? "";
    const match = steamIdPattern.exec(claimedId);
    if (!match || !(await verifySteamAssertion(url.searchParams))) return new Response("Steam verification failed.", { status: 401 });
    const steamId = match[1];
    const profile = await fetchSteamProfile(steamId);
    const session = await mintSessionForIdentity(client, {
      email: `steam_${steamId}@steam.users.picom.local`,
      metadata: { provider: "steam", steam_id: steamId, full_name: profile.name, display_name: profile.name, avatar_url: profile.avatar },
    });
    if (!session || !(await completeHandoff(client, nonce, "steam", session))) return new Response("Could not complete Steam sign-in.", { status: 500 });
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
