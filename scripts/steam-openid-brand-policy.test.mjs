/**
 * Steam OpenID brand / domain policy — realm & return_to must be auth.picom.gg only.
 * Forbidden infrastructure hosts must never appear in browser-facing OpenID URLs.
 *
 *   node scripts/steam-openid-brand-policy.test.mjs
 *   npm run auth:steam:openid-brand
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  AUTH_GATEWAY_HOST,
  STEAM_OPENID_REALM,
  STEAM_OPENID_RETURN_URL,
  STEAM_OPENID_FORBIDDEN_HOST_PATTERNS,
  assertNoInfrastructureLeak,
  assertSteamOpenIdBrandSafe,
  buildCanonicalSteamOpenIdStartUrl,
  expectedSteamReturnTo,
  isForbiddenSteamOpenIdHost,
  isAllowedAuthGatewayRedirect,
} from "../services/auth-gateway/route-contract.mjs";

const nonce = "A".repeat(32);

// --- Canonical contract ---
assert.equal(AUTH_GATEWAY_HOST, "auth.picom.gg");
assert.equal(STEAM_OPENID_REALM, "https://auth.picom.gg/");
assert.equal(STEAM_OPENID_RETURN_URL, "https://auth.picom.gg/steam/callback");

const built = buildCanonicalSteamOpenIdStartUrl(nonce);
assert.equal(built.realm, "https://auth.picom.gg/");
assert.equal(built.returnTo, `https://auth.picom.gg/steam/callback?nonce=${encodeURIComponent(nonce)}`);
assert.equal(expectedSteamReturnTo(nonce), built.returnTo);

const startUrl = new URL(built.url);
assert.equal(startUrl.hostname, "steamcommunity.com");
assert.equal(startUrl.searchParams.get("openid.ns"), "http://specs.openid.net/auth/2.0");
assert.equal(startUrl.searchParams.get("openid.mode"), "checkid_setup");
assert.equal(startUrl.searchParams.get("openid.realm"), "https://auth.picom.gg/");
assert.equal(startUrl.searchParams.get("openid.return_to"), built.returnTo);
assert.equal(startUrl.searchParams.get("openid.identity"), "http://specs.openid.net/auth/2.0/identifier_select");
assert.equal(startUrl.searchParams.get("openid.claimed_id"), "http://specs.openid.net/auth/2.0/identifier_select");
assert.ok(!/supabase/i.test(built.url), "Supabase domain forbidden in Steam start URL");

// Client-supplied realm/return_to are not parameters of the builder — ignored by design.
assert.doesNotThrow(() => buildCanonicalSteamOpenIdStartUrl(nonce));

// --- Forbidden hosts ---
const forbiddenSamples = [
  "ufmtvqtsklqsmqxefbbs.supabase.co",
  "https://ufmtvqtsklqsmqxefbbs.supabase.co/functions/v1/steam-auth",
  "localhost",
  "127.0.0.1",
  "192.168.1.10",
  "abc.ngrok.io",
  "foo.pages.dev",
  "app.vercel.app",
  "site.netlify.app",
  "evil.com",
];
for (const sample of forbiddenSamples) {
  assert.equal(isForbiddenSteamOpenIdHost(sample), true, `must forbid ${sample}`);
}
assert.equal(isForbiddenSteamOpenIdHost("auth.picom.gg"), false);
assert.equal(isForbiddenSteamOpenIdHost("https://auth.picom.gg/"), false);

for (const pattern of STEAM_OPENID_FORBIDDEN_HOST_PATTERNS) {
  assert.ok(pattern instanceof RegExp, "forbidden host pattern must be RegExp");
}

assert.throws(() => assertNoInfrastructureLeak("https://foo.supabase.co/x"), /INFRA_LEAK/);
assert.throws(() => assertSteamOpenIdBrandSafe("openid.realm=https%3A%2F%2Ffoo.supabase.co%2F"), /SUPABASE|INFRA/);
assert.doesNotThrow(() => assertSteamOpenIdBrandSafe(built.url));

// --- Redirect allowlist / open redirect DENY ---
assert.equal(isAllowedAuthGatewayRedirect("https://account.picom.gg/auth/callback"), true);
assert.equal(isAllowedAuthGatewayRedirect("https://account.picom.gg/open-app/abc"), true);
assert.equal(isAllowedAuthGatewayRedirect("picom://auth/callback"), true);
assert.equal(isAllowedAuthGatewayRedirect("https://evil.com/"), false);
assert.equal(isAllowedAuthGatewayRedirect("https://ufmtvqtsklqsmqxefbbs.supabase.co/"), false);
assert.equal(isAllowedAuthGatewayRedirect("//evil.com"), false);

// --- Source contracts: Edge + client + gateway ---
const steam = readFileSync("supabase/functions/steam-auth/index.ts", "utf8");
const service = readFileSync("src/services/auth/socialAuthService.ts", "utf8");
const gateway = readFileSync("services/auth-gateway/index.mjs", "utf8");
const nginx = readFileSync("infra/nginx/auth.picom.gg.conf", "utf8");

assert.ok(steam.includes('CANONICAL_STEAM_REALM = "https://auth.picom.gg/"'), "Edge canonical realm");
assert.ok(steam.includes('CANONICAL_STEAM_RETURN = "https://auth.picom.gg/steam/callback"'), "Edge canonical return");
assert.ok(steam.includes("STEAM_OPENID_REALM") && steam.includes("STEAM_OPENID_RETURN_URL"), "Edge reads OpenID env");
assert.ok(steam.includes("/steam/start?nonce="), "start-link returns gateway start URL");

assert.ok(service.includes("authGatewayUrl") && service.includes("/${provider}/start?nonce="), "client Steam/Epic start uses branded gateway /{provider}/start");
assert.ok(/supabase\\\.\(co\|in\)/.test(service), "client blocks supabase in browser URL");

assert.ok(gateway.includes("/steam/callback") && gateway.includes("check_authentication"), "gateway verifies Steam server-side");
assert.ok(gateway.includes("searchParams.delete(\"openid.realm\")"), "gateway ignores client-supplied realm");
assert.ok(gateway.includes("searchParams.delete(\"openid.return_to\")"), "gateway ignores client-supplied return_to");
assert.ok(nginx.includes("location = /steam/start") && nginx.includes("location = /steam/callback"), "nginx exact paths");
assert.ok(nginx.includes("picom_auth_redacted"), "nginx redacts query from access logs");
assert.ok(!/proxy_pass\s+https?:\/\/[^\s;]*supabase/i.test(nginx), "nginx must not proxy_pass to supabase hosts");
assert.ok(/proxy_pass\s+http:\/\/127\.0\.0\.1:4180/.test(nginx), "nginx proxies only local auth-gateway");

console.log("Steam OpenID brand policy: PASS");
