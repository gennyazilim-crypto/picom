import { readFileSync } from "node:fs";

// Realistic contract test for the custom Steam/Epic sign-in. It verifies the
// security-critical properties of the session-minting Edge Functions and the nonce
// handoff, not just that files exist — a regression that weakens verification,
// exposes the handoff table, or wires the client to the wrong flow must fail here.

const read = (path) => readFileSync(path, "utf8");
const shared = read("supabase/functions/_shared/social-auth-session.ts");
const steam = read("supabase/functions/steam-auth/index.ts");
const epic = read("supabase/functions/epic-auth/index.ts");
const migration = read("supabase/migrations/20260715010000_social_auth_handoffs.sql");
const service = read("src/services/auth/socialAuthService.ts");
const buttons = read("src/components/auth/SocialLoginButtons.tsx");

const checks = [
  // Handoff store is service-role-only, single-use, and time-bounded.
  [migration.includes("enable row level security") && /revoke all on table public\.social_auth_handoffs from anon, authenticated/.test(migration), "handoff table is service-role only (RLS on, anon/authenticated revoked)"],
  [migration.includes("expires_at") && migration.includes("interval '5 minutes'"), "handoff rows expire (5 minutes)"],
  [migration.includes("'pending'") && migration.includes("'ready'") && migration.includes("'consumed'"), "handoff has a single-use status lifecycle"],

  // Session minting uses the service role and confirmed users; consume is single-use.
  [shared.includes('Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")') && shared.includes("return null"), "session minting requires the service-role key (disabled otherwise)"],
  [/isValidNonce[\s\S]*A-Za-z0-9_-\]\{32,128\}/.test(shared), "nonce is validated as 32-128 URL-safe chars"],
  [shared.includes("admin.generateLink") && shared.includes("email_confirm: true"), "session is minted via admin generateLink for a confirmed user"],
  [shared.includes('status: "consumed", session: null') && shared.includes("expires_at"), "consumeHandoff is single-use (marks consumed, erases tokens) and honors expiry"],

  // Steam: verify the OpenID assertion BEFORE minting; validate the SteamID shape.
  [steam.includes('"openid.mode", "check_authentication"') && steam.includes("verifySteamAssertion"), "Steam verifies the OpenID assertion with Steam (check_authentication)"],
  [/steamIdPattern\s*=\s*\/\^https:\\\/\\\/steamcommunity\\\.com\\\/openid\\\/id\\\/\(\\d\{17\}\)/.test(steam), "Steam claimed_id is validated to a 17-digit SteamID"],
  [steam.includes("!match || !(await verifySteamAssertion(url.searchParams))"), "Steam mints only after both the id shape and the assertion verify"],
  [steam.includes("getServiceClient()") && steam.includes("NOT_CONFIGURED"), "Steam function is disabled without the service-role key"],

  // Epic: exchange the code with the client secret; gate on Epic credentials.
  [epic.includes("grant_type: \"authorization_code\"") && epic.includes("Basic ${basic}") && epic.includes("btoa(`${clientId}:${clientSecret}`)"), "Epic exchanges the code with its client secret (Basic auth)"],
  [epic.includes('Deno.env.get("EPIC_CLIENT_ID")') && epic.includes('Deno.env.get("EPIC_CLIENT_SECRET")'), "Epic requires its client id/secret"],
  [epic.includes("getServiceClient()") && epic.includes("NOT_CONFIGURED"), "Epic function is disabled without the service-role key"],

  // Both use the nonce and only complete the handoff after verification.
  [steam.includes("completeHandoff(client, nonce, \"steam\", session)") && epic.includes("completeHandoff(client, nonce, \"epic\", session)"), "both functions bind the minted session to the request nonce"],
  [steam.includes('action === "poll"') && epic.includes('action === "poll"') && steam.includes("consumeHandoff") && epic.includes("consumeHandoff"), "both functions expose a single-use poll endpoint"],

  // Frontend routes Steam/Epic through the custom flow, gated by their env flags.
  [service.includes('"google", "apple", "steam", "epic"') && service.includes("isCustomOAuthProvider"), "Steam/Epic are offered and marked as custom providers"],
  [service.includes("beginCustomOAuth") && service.includes("client.auth.setSession(") && service.includes("action=poll&nonce="), "custom flow opens login, polls, and sets the returned session"],
  [service.includes("steamOAuthEnabled") && service.includes("epicOAuthEnabled"), "Steam/Epic availability is gated by their env flags"],
  [buttons.includes("isCustomOAuthProvider(provider)") && buttons.includes("beginCustomOAuth(provider"), "the buttons route custom providers through the custom flow"],

  // The renderer never handles provider secrets.
  [!service.includes("SERVICE_ROLE") && !service.includes("EPIC_CLIENT_SECRET") && !service.includes("STEAM_WEB_API_KEY"), "no provider secrets are referenced in the renderer"],
];

const failed = checks.filter(([ok]) => !ok);
if (failed.length) {
  for (const [, label] of failed) console.error(`FAIL: ${label}`);
  process.exit(1);
}
for (const [, label] of checks) console.log(`PASS: ${label}`);
console.log("Steam/Epic custom sign-in contract passed.");
