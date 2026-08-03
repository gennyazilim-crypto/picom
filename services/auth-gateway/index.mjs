/**
 * PICOM auth.picom.gg gateway — branded Steam/Epic entrypoints.
 *
 * Browser never sees raw Supabase / Edge URLs. Steam OpenID realm + return_to
 * are always auth.picom.gg. Upstream steam-auth / epic-auth are called
 * server-to-server only.
 *
 * Env:
 *   SUPABASE_URL, SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY for upstream)
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
  expectedSteamReturnTo,
  isAllowedAuthGatewayRedirect,
  isLiveAuthGatewayPath,
} from "./route-contract.mjs";

const PORT = Number(process.env.AUTH_GATEWAY_PORT || 4180);
const BIND = String(process.env.AUTH_GATEWAY_BIND || "127.0.0.1").trim() || "127.0.0.1";
const SUPABASE_URL = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_ANON_KEY = String(process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const ACCOUNT_CENTER_URL = String(process.env.ACCOUNT_CENTER_URL || "https://account.picom.gg").replace(/\/+$/, "");
const MAX_QUERY_LENGTH = 4096;
const STEAM_OPENID_ENDPOINT = "https://steamcommunity.com/openid/login";
const steamIdPattern = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/;

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

function isValidNonce(nonce) {
  return /^[A-Za-z0-9_-]{32,128}$/.test(String(nonce || ""));
}

function steamAuthUpstream(pathQuery) {
  return `${SUPABASE_URL}/functions/v1/steam-auth${pathQuery.startsWith("?") ? pathQuery : `?${pathQuery}`}`;
}

function epicAuthUpstream(pathQuery) {
  return `${SUPABASE_URL}/functions/v1/epic-auth${pathQuery.startsWith("?") ? pathQuery : `?${pathQuery}`}`;
}

/**
 * Forward Steam OpenID callback to steam-auth (server-side only).
 * Steam check_authentication is performed ONLY in the Edge Function —
 * OpenID assertions are single-use; verifying here would break Edge.
 */
async function completeSteamViaEdge(openidParams) {
  const qs = new URLSearchParams(openidParams);
  qs.set("action", "callback");
  // Ensure mode stays id_res for Edge envelope checks (do not rewrite to check_authentication).
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
  const text = await response.text();
  return { status: response.status, text };
}

async function handleSteamStart(url, res) {
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
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
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
  const nonce = url.searchParams.get("nonce") || "";
  if (!isValidNonce(nonce)) {
    html(res, 400, "Picom", "Invalid sign-in request.");
    return;
  }

  const returnTo = url.searchParams.get("openid.return_to") || "";
  const expected = expectedSteamReturnTo(nonce);
  if (returnTo !== expected) {
    console.error("steam_callback_return_to_mismatch", {
      expectedLen: expected.length,
      actualLen: returnTo.length,
      expectedHost: (() => { try { return new URL(expected).host; } catch { return ""; } })(),
      actualHost: (() => { try { return new URL(returnTo).host; } catch { return ""; } })(),
    });
    html(res, 401, "Picom", "Steam verification failed.");
    return;
  }
  // Realm is not always returned in assertion; when present must match.
  const realm = url.searchParams.get("openid.realm");
  if (realm && realm !== STEAM_OPENID_REALM && realm !== STEAM_OPENID_REALM.replace(/\/$/, "")) {
    html(res, 401, "Picom", "Steam verification failed.");
    return;
  }

  const signedFields = new Set((url.searchParams.get("openid.signed") || "").split(","));
  const claimedId = url.searchParams.get("openid.claimed_id") || "";
  const identity = url.searchParams.get("openid.identity") || "";
  const validEnvelope =
    url.searchParams.get("openid.ns") === "http://specs.openid.net/auth/2.0" &&
    url.searchParams.get("openid.mode") === "id_res" &&
    url.searchParams.get("openid.op_endpoint") === STEAM_OPENID_ENDPOINT &&
    returnTo === expected &&
    identity === claimedId &&
    ["claimed_id", "identity", "return_to", "response_nonce", "assoc_handle"].every((field) => signedFields.has(field));
  const match = steamIdPattern.exec(claimedId);
  // Do NOT call Steam check_authentication here — Edge owns that (assertions are single-use).
  if (!validEnvelope || !match) {
    console.error("steam_callback_envelope_deny", {
      hasClaimedId: Boolean(claimedId),
      identityMatch: identity === claimedId,
      mode: url.searchParams.get("openid.mode") || "",
      signed: url.searchParams.get("openid.signed") || "",
    });
    html(res, 401, "Picom", "Steam verification failed.");
    return;
  }

  const result = await completeSteamViaEdge(url.searchParams);
  if (result.status >= 400) {
    console.error("steam_callback_edge_deny", { status: result.status, body: String(result.text || "").slice(0, 80) });
    html(res, result.status === 410 ? 410 : 401, "Picom", result.status === 410 ? "Steam sign-in request expired." : "Steam verification failed.");
    return;
  }

  // Desktop/Account Center poll owns the session; do NOT send the browser to
  // Account Center /auth/callback (that route expects Supabase OAuth code/token_hash
  // and otherwise lands on /auth/error).
  const linked = /connected to your Picom account/i.test(result.text);
  html(res, 200, "Picom", linked ? "Steam is connected to your Picom account." : "You're signed in with Steam.");
}

async function handleEpicStart(url, res) {
  const nonce = url.searchParams.get("nonce") || "";
  if (!isValidNonce(nonce)) {
    html(res, 400, "Picom", "Invalid sign-in request.");
    return;
  }
  const bootstrap = await fetch(epicAuthUpstream(`?action=login&nonce=${encodeURIComponent(nonce)}`), {
    method: "GET",
    redirect: "manual",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
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
  const qs = url.searchParams.toString();
  const upstream = epicAuthUpstream(`?${qs.includes("action=") ? qs : `action=callback&${qs}`}`);
  const response = await fetch(upstream, {
    method: "GET",
    redirect: "manual",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  const text = await response.text();
  if (response.status >= 400) {
    html(res, 401, "Picom", "Epic verification failed.");
    return;
  }
  // Same as Steam: session is delivered via poll; Account Center /auth/callback
  // without a Supabase code incorrectly shows Authentication error.
  const linked = /connected to your Picom account/i.test(text);
  html(res, 200, "Picom", linked ? "Epic is connected to your Picom account." : "You're signed in with Epic.");
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

    if (req.method === "GET" && url.pathname === "/steam/start") {
      await handleSteamStart(url, res);
      return;
    }
    if (req.method === "GET" && url.pathname === "/steam/callback") {
      await handleSteamCallback(url, res);
      return;
    }
    if (req.method === "GET" && url.pathname === "/epic/start") {
      await handleEpicStart(url, res);
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
