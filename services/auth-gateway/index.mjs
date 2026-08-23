/**
 * PICOM auth.picom.gg gateway — branded Steam/Epic entrypoints.
 *
 * Browser never sees raw Supabase / Edge URLs. Steam OpenID realm + return_to
 * are always auth.picom.gg. Upstream steam-auth / epic-auth are called
 * server-to-server only.
 *
 * Env:
 *   SUPABASE_URL, SUPABASE_ANON_KEY (public gateway key only; never service role)
 *   AUTH_GATEWAY_PORT (default 4180)
 *   ACCOUNT_CENTER_URL (default https://account.picom.gg)
 *   PICOM_ALLOWED_ORIGINS (CORS for start; optional)
 */
import http from "node:http";
import { URL } from "node:url";
import {
  AUTH_GATEWAY_HOST,
  STEAM_OPENID_REALM,
  STEAM_OPENID_RETURN_URL,
  assertNoInfrastructureLeak,
  assertSteamOpenIdBrandSafe,
  buildCanonicalSteamOpenIdStartUrl,
  resolveSteamCallbackNonce,
  isAllowedAuthGatewayRedirect,
  isLiveAuthGatewayPath,
} from "./route-contract.mjs";

const PORT = Number(process.env.AUTH_GATEWAY_PORT || 4180);
const BIND = String(process.env.AUTH_GATEWAY_BIND || "127.0.0.1").trim() || "127.0.0.1";
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_ANON_KEY = String(process.env.SUPABASE_ANON_KEY || "").trim();
const ACCOUNT_CENTER_URL = String(process.env.ACCOUNT_CENTER_URL || "https://account.picom.gg").replace(/\/+$/, "");
const MAX_QUERY_LENGTH = 4096;

function requireConfig() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("AUTH_GATEWAY_NOT_CONFIGURED");
  }
  if (/supabase\.co/i.test(ACCOUNT_CENTER_URL)) {
    throw new Error("ACCOUNT_CENTER_MUST_BE_PICOM");
  }
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  assertNoInfrastructureLeak(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  });
  res.end(payload);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function pageTone(status) {
  if (status >= 200 && status < 300) return "success";
  if (status === 410 || status === 429) return "warning";
  return "error";
}

function pageHeadline(status, message) {
  const text = String(message || "");
  if (status === 410 || /expired/i.test(text)) return "Sign-in request expired";
  if (status >= 200 && status < 300) {
    if (/connected/i.test(text)) return "Connected";
    return "You're signed in";
  }
  if (/unavailable|too many|too large/i.test(text)) return "Sign-in unavailable";
  if (/invalid/i.test(text)) return "Invalid request";
  return "Sign-in could not be completed";
}

/**
 * Branded auth.picom.gg status page.
 * Fully self-contained (inline CSS + SVG) so nginx CSP default-src 'none'
 * only needs style-src 'unsafe-inline' — no fonts/CDN/img hosts.
 */
function html(res, status, title, message) {
  const tone = pageTone(status);
  const safeTitle = escapeHtml(title || "Picom");
  const safeMessage = escapeHtml(message || "Something went wrong.");
  const headline = escapeHtml(pageHeadline(status, message));
  const loginUrl = escapeHtml(`${ACCOUNT_CENTER_URL}/login`);
  const supportUrl = escapeHtml("https://support.picom.gg/?source=auth-gateway");
  const toneLabel = tone === "success" ? "Success" : tone === "warning" ? "Attention" : "Error";
  const iconSvg =
    tone === "success"
      ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 6 9 17l-5-5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      : tone === "warning"
        ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.2"/><path d="M12 7v6M12 16h.01" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>'
        : '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.2"/><path d="m15 9-6 6M9 9l6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';

  const body = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="color-scheme" content="dark"/>
<meta name="referrer" content="no-referrer"/>
<title>${safeTitle}</title>
<style>
html,body{height:100%;margin:0}
body{
  font-family:"Segoe UI",system-ui,-apple-system,sans-serif;
  color:#eef2f6;
  background:#0a0c10;
  background-image:
    radial-gradient(ellipse 900px 480px at 50% -80px,rgba(20,184,166,.18),transparent 60%),
    radial-gradient(ellipse 420px 320px at 90% 10%,rgba(34,211,238,.08),transparent 55%),
    linear-gradient(180deg,#0d1016 0%,#0a0c10 50%,#07090d 100%);
  -webkit-font-smoothing:antialiased;
}
.shell{min-height:100%;display:flex;align-items:center;justify-content:center;padding:40px 20px}
.card{
  width:100%;max-width:420px;padding:32px 28px 28px;text-align:center;
  background:#141821;border:1px solid rgba(255,255,255,.08);border-radius:16px;
  box-shadow:0 24px 56px rgba(0,0,0,.45);
}
.brand{display:inline-flex;align-items:center;gap:12px;margin:0 auto 24px;text-decoration:none;color:#eef2f6}
.mark{
  width:40px;height:40px;border-radius:10px;display:grid;place-items:center;
  background:linear-gradient(145deg,#14b8a6,#0d9488);color:#061016;font-weight:800;font-size:1.05rem;
  letter-spacing:-.04em;box-shadow:0 8px 20px rgba(20,184,166,.28);
}
.brand-text{text-align:left;line-height:1.15}
.brand-name{display:block;font-weight:700;font-size:1.12rem;letter-spacing:-.02em}
.brand-sub{display:block;margin-top:3px;font-size:.68rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#9aa3b2}
.icon{
  width:52px;height:52px;margin:0 auto 16px;border-radius:999px;display:grid;place-items:center;
}
.tone-success .icon{background:rgba(52,211,153,.14);color:#34d399}
.tone-warning .icon{background:rgba(245,158,11,.14);color:#f59e0b}
.tone-error .icon{background:rgba(244,63,94,.14);color:#f43f5e}
h1{margin:0 0 10px;font-size:1.4rem;font-weight:700;letter-spacing:-.03em;line-height:1.25}
.lead{margin:0 0 8px;color:#9aa3b2;font-size:.95rem;line-height:1.5}
.hint{margin:0 0 24px;color:#6f7888;font-size:.86rem;line-height:1.45}
.actions{display:flex;flex-wrap:wrap;gap:10px;justify-content:center}
.btn{
  display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:0 16px;
  border-radius:10px;font:600 .9rem/1 "Segoe UI",system-ui,sans-serif;text-decoration:none;
  border:1px solid transparent;
}
.btn-primary{background:#14b8a6;color:#061016}
.btn-primary:hover{background:#2dd4bf}
.btn-ghost{background:transparent;color:#9aa3b2;border-color:rgba(255,255,255,.1)}
.btn-ghost:hover{color:#eef2f6;border-color:rgba(255,255,255,.18)}
.foot{margin:22px 0 0;font-size:.72rem;color:#525a68;letter-spacing:.02em}
</style>
</head>
<body>
<main class="shell">
  <section class="card tone-${tone}" aria-live="polite" aria-label="${toneLabel}">
    <a class="brand" href="${loginUrl}">
      <span class="mark" aria-hidden="true">P</span>
      <span class="brand-text">
        <span class="brand-name">Picom</span>
        <span class="brand-sub">Auth</span>
      </span>
    </a>
    <div class="icon">${iconSvg}</div>
    <h1>${headline}</h1>
    <p class="lead">${safeMessage}</p>
    <p class="hint">You can close this window and return to Picom.</p>
    <div class="actions">
      <a class="btn btn-primary" href="picom://auth/open">Open Picom</a>
      <a class="btn btn-ghost" href="${loginUrl}">Account Center</a>
      <a class="btn btn-ghost" href="${supportUrl}">Support</a>
    </div>
    <p class="foot">auth.picom.gg</p>
  </section>
</main>
</body>
</html>`;
  assertNoInfrastructureLeak(body);
  res.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  });
  res.end(body);
}

function redirect(res, location) {
  if (!isAllowedAuthGatewayRedirect(location) && !location.startsWith("https://steamcommunity.com/")) {
    throw new Error("AUTH_GATEWAY_OPEN_REDIRECT");
  }
  assertNoInfrastructureLeak(location);
  res.writeHead(302, {
    Location: location,
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
  });
  res.end();
}

/** Only used after decodeGoogleAuthorize validates the exact configured Supabase authorize URL. */
function redirectToValidatedGoogleAuthorize(res, location) {
  res.writeHead(302, {
    Location: location,
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
  });
  res.end();
}

function isValidNonce(nonce) {
  return /^[A-Za-z0-9_-]{32,128}$/.test(String(nonce || ""));
}

function isValidOAuthCode(code) {
  return /^[A-Za-z0-9._~-]{8,1024}$/.test(String(code || ""));
}

function buildDesktopAuthCallback({ provider, state, code, exchange, error }) {
  if (!isValidNonce(state) || (provider !== "google" && provider !== "apple" && provider !== "steam" && provider !== "epic")) {
    throw new Error("AUTH_GATEWAY_INVALID_CALLBACK");
  }
  const values = [code, exchange, error].filter(Boolean);
  if (values.length !== 1) throw new Error("AUTH_GATEWAY_INVALID_CALLBACK");
  if (code && (!isValidOAuthCode(code) || (provider !== "google" && provider !== "apple"))) throw new Error("AUTH_GATEWAY_INVALID_CALLBACK");
  if (exchange && (!isValidNonce(exchange) || (provider !== "steam" && provider !== "epic"))) throw new Error("AUTH_GATEWAY_INVALID_CALLBACK");
  if (error && !/^AUTH_[A-Z_]{3,80}$/.test(error)) throw new Error("AUTH_GATEWAY_INVALID_CALLBACK");
  const callback = new URL("picom://auth/callback");
  callback.searchParams.set("provider", provider);
  callback.searchParams.set("state", state);
  if (code) callback.searchParams.set("code", code);
  if (exchange) callback.searchParams.set("exchange", exchange);
  if (error) callback.searchParams.set("error", error);
  return callback.toString();
}

function decodeGoogleAuthorize(value, state) {
  if (!isValidNonce(state) || !/^[A-Za-z0-9_-]{32,8192}$/.test(String(value || ""))) return null;
  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    if (Buffer.from(decoded, "utf8").toString("base64url") !== value) return null;
    const authorize = new URL(decoded);
    const configured = new URL(SUPABASE_URL);
    const expectedCallback = `https://${AUTH_GATEWAY_HOST}/google/callback?state=${encodeURIComponent(state)}`;
    if (
      authorize.protocol !== "https:"
      || authorize.origin !== configured.origin
      || authorize.pathname !== "/auth/v1/authorize"
      || authorize.searchParams.get("provider") !== "google"
      || authorize.searchParams.get("redirect_to") !== expectedCallback
      || !authorize.searchParams.get("code_challenge")
    ) return null;
    return authorize.toString();
  } catch {
    return null;
  }
}

/** Preserve browser/client IP when the gateway calls Supabase Edge (rate limits need an address). */
function upstreamClientHeaders(req, extra = {}) {
  const forwarded = req.headers["x-forwarded-for"];
  const realIp = req.headers["x-real-ip"];
  const peer = req.socket?.remoteAddress;
  const clientIp =
    (typeof forwarded === "string" && forwarded.trim())
    || (typeof realIp === "string" && realIp.trim())
    || (typeof peer === "string" && peer.trim())
    || "127.0.0.1";
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "X-Forwarded-For": typeof forwarded === "string" && forwarded.trim() ? forwarded : clientIp,
    "X-Real-IP": typeof realIp === "string" && realIp.trim() ? realIp : clientIp,
    ...extra,
  };
}

function steamAuthUpstream(pathQuery) {
  return `${SUPABASE_URL}/functions/v1/steam-auth${pathQuery.startsWith("?") ? pathQuery : `?${pathQuery}`}`;
}

function epicAuthUpstream(pathQuery) {
  return `${SUPABASE_URL}/functions/v1/epic-auth${pathQuery.startsWith("?") ? pathQuery : `?${pathQuery}`}`;
}

async function handleGoogleStart(url, res) {
  const state = url.searchParams.get("state") || "";
  const authorize = decodeGoogleAuthorize(url.searchParams.get("authorize") || "", state);
  if (!authorize) {
    html(res, 400, "Picom", "Invalid sign-in request.");
    return;
  }
  redirectToValidatedGoogleAuthorize(res, authorize);
}

async function handleGoogleCallback(url, res) {
  const state = url.searchParams.get("state") || "";
  if (!isValidNonce(state)) {
    html(res, 400, "Picom", "Invalid sign-in request.");
    return;
  }
  const code = url.searchParams.get("code") || "";
  const providerError = url.searchParams.get("error") || "";
  if (providerError) {
    redirect(res, buildDesktopAuthCallback({
      provider: "google",
      state,
      error: providerError === "access_denied" ? "AUTH_CANCELLED" : "AUTH_PROVIDER_FAILED",
    }));
    return;
  }
  if (!isValidOAuthCode(code)) {
    redirect(res, buildDesktopAuthCallback({ provider: "google", state, error: "AUTH_CALLBACK_FAILED" }));
    return;
  }
  redirect(res, buildDesktopAuthCallback({ provider: "google", state, code }));
}

async function handleSteamStart(url, res, req) {
  const nonce = url.searchParams.get("nonce") || "";
  // Ignore any client-supplied realm/return_to.
  url.searchParams.delete("realm");
  url.searchParams.delete("return_to");
  url.searchParams.delete("openid.realm");
  url.searchParams.delete("openid.return_to");

  if (!isValidNonce(nonce)) {
    html(res, 400, "Picom", "Invalid sign-in request.");
    return;
  }

  // Ensure Edge handoff exists (login creates pending row).
  const bootstrap = await fetch(steamAuthUpstream(`?action=login&nonce=${encodeURIComponent(nonce)}`), {
    method: "GET",
    redirect: "manual",
    headers: upstreamClientHeaders(req),
  });

  if (bootstrap.status === 429) {
    html(res, 429, "Picom", "Too many sign-in attempts. Try again shortly.");
    return;
  }
  if (bootstrap.status >= 400 && bootstrap.status !== 302) {
    html(res, 503, "Picom", "Steam sign-in is temporarily unavailable.");
    return;
  }

  // Prefer Location from Edge if it already uses canonical realm; otherwise build local.
  let steamUrl = bootstrap.headers.get("location") || "";
  try {
    if (steamUrl) assertSteamOpenIdBrandSafe(steamUrl);
  } catch {
    steamUrl = "";
  }
  if (!steamUrl) {
    steamUrl = buildCanonicalSteamOpenIdStartUrl(nonce).url;
  } else {
    assertSteamOpenIdBrandSafe(steamUrl);
  }
  redirect(res, steamUrl);
}

async function handleSteamCallback(url, res) {
  if (url.search.length > MAX_QUERY_LENGTH) {
    html(res, 414, "Picom", "Request too large.");
    return;
  }
  const nonce = resolveSteamCallbackNonce(url.searchParams);
  if (!isValidNonce(nonce)) {
    html(res, 400, "Picom", "Invalid sign-in request.");
    return;
  }

  // OpenID verification (check_authentication + envelope) runs only in steam-auth Edge —
  // assertions are single-use; duplicating checks here caused false "verification failed".
  const qs = new URLSearchParams(url.searchParams);
  qs.set("action", "callback");
  qs.set("nonce", nonce);
  if (qs.get("openid.mode") === "check_authentication") {
    qs.set("openid.mode", "id_res");
  }

  const upstream = steamAuthUpstream(`?${qs.toString()}`);
  const response = await fetch(upstream, {
    method: "GET",
    redirect: "manual",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  await response.text();
  if (response.status >= 400) {
    redirect(res, buildDesktopAuthCallback({
      provider: "steam",
      state: nonce,
      error: response.status === 410 ? "AUTH_CALLBACK_FAILED" : "AUTH_PROVIDER_FAILED",
    }));
    return;
  }
  redirect(res, buildDesktopAuthCallback({ provider: "steam", state: nonce, exchange: nonce }));
}

async function handleEpicStart(url, res, req) {
  const nonce = url.searchParams.get("nonce") || "";
  if (!isValidNonce(nonce)) {
    html(res, 400, "Picom", "Invalid sign-in request.");
    return;
  }
  const bootstrap = await fetch(epicAuthUpstream(`?action=login&nonce=${encodeURIComponent(nonce)}`), {
    method: "GET",
    redirect: "manual",
    headers: upstreamClientHeaders(req),
  });
  const location = bootstrap.headers.get("location") || "";
  if (!location || bootstrap.status !== 302) {
    html(res, 503, "Picom", "Epic sign-in is temporarily unavailable.");
    return;
  }
  // Epic authorize host is epicgames.com — allowed external IdP.
  if (!/^https:\/\/(www\.)?epicgames\.com\//i.test(location)) {
    html(res, 502, "Picom", "Epic sign-in is temporarily unavailable.");
    return;
  }
  res.writeHead(302, { Location: location, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
  res.end();
}

async function handleEpicCallback(url, res) {
  if (url.search.length > MAX_QUERY_LENGTH) {
    html(res, 414, "Picom", "Request too large.");
    return;
  }
  const nonce = url.searchParams.get("state") || url.searchParams.get("nonce") || "";
  if (!isValidNonce(nonce)) {
    html(res, 400, "Picom", "Invalid sign-in request.");
    return;
  }
  const qs = new URLSearchParams(url.searchParams);
  qs.set("action", "callback");
  qs.set("nonce", nonce);
  const upstream = epicAuthUpstream(`?${qs.toString()}`);
  const response = await fetch(upstream, {
    method: "GET",
    redirect: "manual",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  await response.text();
  if (response.status >= 400) {
    redirect(res, buildDesktopAuthCallback({ provider: "epic", state: nonce, error: "AUTH_PROVIDER_FAILED" }));
    return;
  }
  redirect(res, buildDesktopAuthCallback({ provider: "epic", state: nonce, exchange: nonce }));
}

const server = http.createServer(async (req, res) => {
  try {
    requireConfig();
    const host = String(req.headers.host || "").split(":")[0].toLowerCase();
    if (host && host !== AUTH_GATEWAY_HOST && host !== "127.0.0.1" && host !== "localhost") {
      // Allow localhost only for health checks behind nginx (Host rewritten to auth.picom.gg in prod).
      if (process.env.AUTH_GATEWAY_ALLOW_ANY_HOST !== "true") {
        res.writeHead(421, { "Content-Type": "text/plain" });
        res.end("Misdirected Request");
        return;
      }
    }

    const rawUrl = req.url || "/";
    if (rawUrl.length > MAX_QUERY_LENGTH + 64) {
      html(res, 414, "Picom", "Request too large.");
      return;
    }
    const url = new URL(rawUrl, `https://${AUTH_GATEWAY_HOST}`);
    if (!isLiveAuthGatewayPath(url.pathname)) {
      res.writeHead(404, { "Content-Type": "text/plain", "Cache-Control": "no-store" });
      res.end("Not found.");
      return;
    }

    if (req.method === "GET" && url.pathname === "/health") {
      json(res, 200, { ok: true, host: AUTH_GATEWAY_HOST, steamRealm: STEAM_OPENID_REALM, steamReturn: STEAM_OPENID_RETURN_URL });
      return;
    }

    if (req.method === "GET" && url.pathname === "/google/start") {
      await handleGoogleStart(url, res);
      return;
    }
    if (req.method === "GET" && url.pathname === "/google/callback") {
      await handleGoogleCallback(url, res);
      return;
    }
    if (req.method === "GET" && url.pathname === "/steam/start") {
      await handleSteamStart(url, res, req);
      return;
    }
    if (req.method === "GET" && url.pathname === "/steam/callback") {
      await handleSteamCallback(url, res);
      return;
    }
    if (req.method === "GET" && url.pathname === "/epic/start") {
      await handleEpicStart(url, res, req);
      return;
    }
    if (req.method === "GET" && url.pathname === "/epic/callback") {
      await handleEpicCallback(url, res);
      return;
    }

    res.writeHead(405, { "Content-Type": "text/plain" });
    res.end("Method not allowed.");
  } catch (error) {
    const code = error instanceof Error ? error.message : "AUTH_GATEWAY_ERROR";
    const safe = /INFRA_LEAK|OPEN_REDIRECT|SUPABASE/i.test(code) ? "Request rejected." : "Something went wrong.";
    try {
      html(res, 500, "Picom", safe);
    } catch {
      res.writeHead(500);
      res.end("Error");
    }
  }
});

server.listen(PORT, BIND, () => {
  console.log(`auth-gateway listening on ${BIND}:${PORT} host=${AUTH_GATEWAY_HOST}`);
});
