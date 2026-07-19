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
const serviceRoleGrants = read("supabase/migrations/20260715020000_social_auth_service_role_table_grants.sql");
const service = read("src/services/auth/socialAuthService.ts");
const buttons = read("src/components/auth/SocialLoginButtons.tsx");
const config = read("supabase/config.toml");
const manifest = JSON.parse(read("supabase/functions/release-manifest.json"));

const checks = [
  // Handoff store is service-role-only, single-use, and time-bounded.
  [migration.includes("enable row level security") && /revoke all on table public\.social_auth_handoffs from public, anon, authenticated/.test(migration), "handoff table is service-role only (RLS on, public/anon/authenticated revoked)"],
  [serviceRoleGrants.includes("grant select, insert, update, delete on table public.social_auth_handoffs to service_role"), "service role has only the table operations required for OAuth handoff lifecycle"],
  [migration.includes("expires_at") && migration.includes("interval '5 minutes'"), "handoff rows expire (5 minutes)"],
  [migration.includes("'pending'") && migration.includes("'ready'") && migration.includes("'consumed'"), "handoff has a single-use status lifecycle"],
  [migration.includes("consume_social_auth_handoff") && migration.includes("for update") && migration.includes("grant execute on function public.consume_social_auth_handoff(text) to service_role"), "handoff consumption is atomic and service-role only"],
  [migration.includes("social_auth_rate_limits") && migration.includes("consume_social_auth_rate_limit") && migration.includes("bucket_key ~ '^[a-f0-9]{64}$'"), "unauthenticated login starts use a hashed rate-limit bucket"],

  // Session minting uses the service role and confirmed users; consume is single-use.
  [shared.includes('Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")') && shared.includes("return null"), "session minting requires the service-role key (disabled otherwise)"],
  [/isValidNonce[\s\S]*A-Za-z0-9_-\]\{32,128\}/.test(shared), "nonce is validated as 32-128 URL-safe chars"],
  [shared.includes("admin.generateLink") && shared.includes("email_confirm: true") && shared.includes("hashed_token") && shared.includes("verifyOtp"), "session is minted from a one-time token hash for a confirmed user"],
  [shared.includes("verificationClient.auth.verifyOtp") && !shared.includes("client.auth.verifyOtp"), "OTP verification cannot replace the service-role client's authorization state"],
  [shared.includes('rpc("consume_social_auth_handoff"') && !shared.includes("properties.action_link"), "consumeHandoff is database-atomic and session mint does not parse redirect fragments"],
  [shared.includes("SOCIAL_AUTH_RATE_LIMIT_SALT") && shared.includes('rpc("consume_social_auth_rate_limit"'), "provider login starts require server-side salted rate limiting"],

  // Steam: verify the OpenID assertion BEFORE minting; validate the SteamID shape.
  [steam.includes('"openid.mode", "check_authentication"') && steam.includes("verifySteamAssertion"), "Steam verifies the OpenID assertion with Steam (check_authentication)"],
  [/steamIdPattern\s*=\s*\/\^https:\\\/\\\/steamcommunity\\\.com\\\/openid\\\/id\\\/\(\\d\{17\}\)/.test(steam), "Steam claimed_id is validated to a 17-digit SteamID"],
  [steam.includes("!validEnvelope || !match || !(await verifySteamAssertion(url.searchParams))"), "Steam mints only after envelope, id shape, and assertion verification"],
  [steam.includes('url.searchParams.get("openid.return_to") === expectedReturnTo') && steam.includes('url.searchParams.get("openid.op_endpoint") === STEAM_OPENID_ENDPOINT'), "Steam validates the signed return target and provider endpoint"],
  [steam.includes("isPendingHandoff") && steam.includes("consumeSocialAuthRateLimit"), "Steam requires a live handoff and rate limit before minting"],
  [steam.includes("getServiceClient()") && steam.includes("NOT_CONFIGURED"), "Steam function is disabled without the service-role key"],

  // Epic: exchange the code with the client secret; gate on Epic credentials.
  [epic.includes("grant_type: \"authorization_code\"") && epic.includes("Basic ${basic}") && epic.includes("btoa(`${clientId}:${clientSecret}`)"), "Epic exchanges the code with its client secret (Basic auth)"],
  [epic.includes('Deno.env.get("EPIC_CLIENT_ID")') && epic.includes('Deno.env.get("EPIC_CLIENT_SECRET")') && epic.includes('Deno.env.get("EPIC_DEPLOYMENT_ID")'), "Epic requires its client id/secret and deployment id"],
  [epic.includes("deployment_id: deploymentId"), "Epic binds authorization-code exchange to the configured deployment"],
  [epic.includes("getServiceClient()") && epic.includes("NOT_CONFIGURED"), "Epic function is disabled without the service-role key"],
  [epic.includes("isPendingHandoff") && epic.includes("consumeSocialAuthRateLimit") && epic.includes("functionBaseUrl()"), "Epic binds callback state to a pending handoff and canonical redirect"],

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
  [config.includes("[functions.steam-auth]\nverify_jwt = false") && config.includes("[functions.epic-auth]\nverify_jwt = false"), "custom provider entrypoints explicitly allow pre-session browser redirects"],
  [manifest.releasePublic.some((entry) => entry.name === "steam-auth" && entry.verifyJwt === false) && manifest.releasePublic.some((entry) => entry.name === "epic-auth" && entry.verifyJwt === false), "release manifest classifies both guarded custom-auth entrypoints"],
];

const failed = checks.filter(([ok]) => !ok);
if (failed.length) {
  for (const [, label] of failed) console.error(`FAIL: ${label}`);
  process.exit(1);
}
for (const [, label] of checks) console.log(`PASS: ${label}`);
console.log("Steam/Epic custom sign-in contract passed.");
