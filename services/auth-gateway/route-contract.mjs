/**
 * auth.picom.gg callback gateway — route allowlist and redirect policy contract.
 * Browser must never be sent to raw Supabase / Edge Function URLs.
 */

export const AUTH_GATEWAY_HOST = "auth.picom.gg";

/** Canonical Steam OpenID relying-party (exact). */
export const STEAM_OPENID_REALM = "https://auth.picom.gg/";
/** Branded PICOM auth-gateway callback (Hostwinds). Not raw supabase.co. */
export const STEAM_OPENID_RETURN_URL = "https://auth.picom.gg/steam/callback";

export const AUTH_GATEWAY_PATHS = Object.freeze([
  "/health",
  "/steam/start",
  "/steam/callback",
  "/epic/start",
  "/epic/callback",
  // Legacy aliases kept for contract compatibility; nginx may 404 them.
  "/callback/google",
  "/callback/steam",
  "/callback/epic",
  "/exchange",
  "/cancelled",
  "/failed",
]);

/** Paths that must be served by the live auth gateway (exact). */
export const AUTH_GATEWAY_LIVE_PATHS = Object.freeze([
  "/health",
  "/steam/start",
  "/steam/callback",
  "/epic/start",
  "/epic/callback",
]);

export const AUTH_GATEWAY_POST_REDIRECT_ALLOWLIST = Object.freeze([
  "https://account.picom.gg",
  "https://app.picom.gg",
  "https://www.picom.gg",
  "https://picom.gg",
  "picom://",
]);

/** Hosts forbidden in Steam OpenID realm / return_to / browser redirects. */
export const STEAM_OPENID_FORBIDDEN_HOST_PATTERNS = Object.freeze([
  /(^|\.)supabase\.co$/i,
  /(^|\.)supabase\.in$/i,
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,
  /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d?\d)$/,
  /(^|\.)ngrok(\.|-)/i,
  /(^|\.)pages\.dev$/i,
  /(^|\.)vercel\.app$/i,
  /(^|\.)netlify\.app$/i,
]);

/**
 * @param {string} path
 */
export function isAllowedAuthGatewayPath(path) {
  const normalized = String(path ?? "").split("?")[0].split("#")[0];
  return AUTH_GATEWAY_PATHS.includes(normalized);
}

/**
 * @param {string} path
 */
export function isLiveAuthGatewayPath(path) {
  const normalized = String(path ?? "").split("?")[0].split("#")[0];
  return AUTH_GATEWAY_LIVE_PATHS.includes(normalized);
}

/**
 * @param {string} target
 */
export function isAllowedAuthGatewayRedirect(target) {
  const value = String(target ?? "").trim();
  if (!value) return false;
  if (value.startsWith("picom://")) return true;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return false;
    const origin = url.origin.toLowerCase();
    return AUTH_GATEWAY_POST_REDIRECT_ALLOWLIST.some((allowed) => {
      if (allowed.startsWith("picom://")) return false;
      return origin === allowed || value.toLowerCase().startsWith(`${allowed}/`);
    });
  } catch {
    return false;
  }
}

/**
 * @param {string} hostOrUrl
 * @returns {boolean} true if host is NOT the sole allowed relying-party host
 */
export function isForbiddenSteamOpenIdHost(hostOrUrl) {
  let host = String(hostOrUrl ?? "").trim().toLowerCase();
  try {
    if (host.includes("://")) host = new URL(host).hostname;
  } catch {
    return true;
  }
  if (!host) return true;
  if (host === AUTH_GATEWAY_HOST) return false;
  return true;
}

/**
 * Build Steam OpenID checkid_setup URL with canonical realm/return_to.
 * Client-supplied realm/return_to must never be accepted — only nonce is bound.
 * @param {string} nonce
 * @param {string} [steamEndpoint]
 */
export function buildCanonicalSteamOpenIdStartUrl(nonce, steamEndpoint = "https://steamcommunity.com/openid/login") {
  const safeNonce = String(nonce ?? "").trim();
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(safeNonce)) {
    throw new Error("STEAM_OPENID_INVALID_NONCE");
  }
  const returnTo = `${STEAM_OPENID_RETURN_URL}?nonce=${encodeURIComponent(safeNonce)}`;
  if (isForbiddenSteamOpenIdHost(STEAM_OPENID_REALM) || isForbiddenSteamOpenIdHost(returnTo)) {
    throw new Error("STEAM_OPENID_FORBIDDEN_HOST");
  }
  const openid = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": returnTo,
    "openid.realm": STEAM_OPENID_REALM,
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
  });
  const url = `${steamEndpoint}?${openid.toString()}`;
  assertNoInfrastructureLeak(url);
  assertSteamOpenIdBrandSafe(url);
  return { url, returnTo, realm: STEAM_OPENID_REALM };
}

/**
 * Exact return_to expected for a nonce (Steam signed field must match).
 * @param {string} nonce
 */
export function expectedSteamReturnTo(nonce) {
  return `${STEAM_OPENID_RETURN_URL}?nonce=${encodeURIComponent(String(nonce ?? "").trim())}`;
}

/**
 * @param {string} blob
 */
export function assertSteamOpenIdBrandSafe(blob) {
  const source = String(blob ?? "");
  assertNoInfrastructureLeak(source);
  if (/openid\.realm=https?%3A%2F%2F[^&]*supabase/i.test(source) || /openid\.return_to=https?%3A%2F%2F[^&]*supabase/i.test(source)) {
    throw new Error("STEAM_OPENID_SUPABASE_IN_BROWSER_URL");
  }
  if (/openid\.realm=https:\/\/auth\.picom\.gg\/?/i.test(source) === false && /openid\.realm/.test(source)) {
    // When openid.realm is present it must be auth.picom.gg
    const realmMatch = source.match(/openid\.realm=([^&]+)/i);
    if (realmMatch) {
      const realm = decodeURIComponent(realmMatch[1]);
      if (!realm.startsWith(STEAM_OPENID_REALM.replace(/\/$/, "")) && realm !== STEAM_OPENID_REALM) {
        throw new Error("STEAM_OPENID_REALM_NOT_CANONICAL");
      }
    }
  }
}

/**
 * Reject open redirects and infrastructure leakage in gateway responses.
 * @param {string} blob
 */
export function assertNoInfrastructureLeak(blob) {
  const source = String(blob ?? "").toLowerCase();
  const banned = [
    "supabase.co",
    "supabase.in",
    "functions.supabase",
    "localhost",
    "127.0.0.1",
    "service_role",
    "client_secret",
    "ngrok",
    "pages.dev",
    "vercel.app",
    "netlify.app",
  ];
  for (const term of banned) {
    if (source.includes(term)) {
      throw new Error(`AUTH_GATEWAY_INFRA_LEAK:${term}`);
    }
  }
}
