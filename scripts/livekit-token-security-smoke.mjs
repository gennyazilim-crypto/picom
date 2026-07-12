import { readFileSync } from "node:fs";

const read = (file) => readFileSync(file, "utf8");
const fn = read("supabase/functions/livekit-token/index.ts");
const token = read("supabase/functions/_shared/livekit-token.ts");
const memberMigration = read("supabase/migrations/20260712166000_active_member_voice_screen_access.sql");
const rateLimitMigration = read("supabase/migrations/20260712166200_livekit_token_rate_limit_reconciliation.sql");
const rateLimitKeywordFix = read("supabase/migrations/20260712166300_livekit_token_rate_limit_keyword_fix.sql");
const moderationMigration = read("supabase/migrations/20260712164500_v1_voice_permission_matrix.sql");
const config = read("supabase/config.toml");
const client = read("src/services/livekit/livekitService.ts");
const fixture = read("scripts/livekit-token-member-hosted-fixture.mjs");
const deploy = read("scripts/deploy-livekit-token-staging.mjs");
const authorizationSql = memberMigration.slice(memberMigration.indexOf("create or replace function public.authorize_livekit_room"), memberMigration.indexOf("revoke all on function public.is_active_community_media_member"));

const checks = [
  ["JWT verified", fn.includes("requireSupabaseUser") && /\[functions\.livekit-token\]\s*verify_jwt\s*=\s*true/.test(config)],
  ["canonical active human profile", fn.includes('.from("profiles")') && fn.includes("deletion_requested_at") && fn.includes("profile.is_bot") && fn.includes("canonicalParticipantName") && !fn.includes("user_metadata")],
  ["server-side V1 release gate", fn.includes("PICOM_V1_VOICE_SCREEN_ENABLED") && fn.includes("isV1VoiceScreenEnabled")],
  ["active-member authorization RPC", fn.includes('rpc("authorize_livekit_room"') && memberMigration.includes("is_active_community_media_member") && memberMigration.includes("VOICE_MEMBERSHIP_REQUIRED")],
  ["visitor ban timeout removal denial", memberMigration.includes("community_members") && memberMigration.includes("community_bans") && memberMigration.includes("community_member_timeouts") && memberMigration.includes("deletion_requested_at")],
  ["ordinary media has no role or channel override gate", !authorizationSql.includes("effective_community_permission") && !authorizationSql.includes("viewPrivateChannels") && !authorizationSql.includes("kind<>'text'")],
  ["moderation remains role-aware", moderationMigration.includes("authorize_livekit_voice_moderation") && moderationMigration.includes("VOICE_ROLE_HIERARCHY_DENIED") && moderationMigration.includes("effective_community_permission")],
  ["short least privilege token", fn.includes("10 * 60") && token.includes("canPublishSources") && fn.includes('"microphone"') && fn.includes('"screen_share"') && fn.includes('"screen_share_audio"') && fn.includes("canPublishData: false")],
  ["hosted LiveKit token rate limit is canonical", rateLimitMigration.includes("'livekit_token',10,60") && rateLimitMigration.includes("meeting_privileged_action") && rateLimitMigration.includes("consume_current_user_action_rate_limit")],
  ["rate-limit timestamp avoids SQL keyword collision", rateLimitKeywordFix.includes("observed_at timestamptz") && !rateLimitKeywordFix.includes("current_time timestamptz")],
  ["capabilities returned to renderer", fn.includes("canPublishAudio: authorization.can_publish_audio") && fn.includes("canPublishScreen: authorization.can_publish_screen")],
  ["fail-closed restricted CORS", fn.includes("PICOM_ALLOWED_ORIGINS") && fn.includes("if (!allowedOrigins.size)") && fn.includes("Origin is not allowed") && !fn.includes('"Access-Control-Allow-Origin": "*"')],
  ["safe provider URL", fn.includes('url.protocol === "wss:"') && fn.includes('url.protocol === "ws:"') && fn.includes("url.username || url.password")],
  ["method and bounded JSON", fn.includes("maxBodyBytes = 2048") && fn.includes("Content-Type must be application/json") && fn.includes("methodNotAllowed")],
  ["deterministic identity room", fn.includes("auth.user.id") && fn.includes("createPicomLiveKitRoomName") && fn.includes("matchesPicomLiveKitRoomName")],
  ["hosted roleless and denial matrix", ["owner", "admin", "moderator", "member", "roleless_member", "visitor", "non_member", "banned", "rate_limit"].every((actor) => fixture.includes(`\"${actor}\"`))],
  ["hosted source and rate assertions", fixture.includes("screen_share_audio") && fixture.includes("camera") && fixture.includes("RATE_LIMITED") && fixture.includes("attempt <= 10")],
  ["hosted failures expose only bounded response codes", fixture.includes("safeResponseCode") && fixture.includes("^[A-Z0-9_]{1,64}$")],
  ["hosted rate-limit RPC has redacted diagnostic preflight", fixture.includes("safeDatabaseCode") && fixture.includes("safeDatabaseDiagnostic") && fixture.includes("[REDACTED_UUID]") && fixture.includes("delete from public.user_action_rate_limits")],
  ["hosted fixture usernames respect profile constraints", fixture.includes("actorCodes") && fixture.includes("username.length < 3 || username.length > 32")],
  ["roleless fixture restores membership integrity trigger", fixture.includes("disable trigger community_member_role_integrity") && fixture.includes("enable trigger community_member_role_integrity")],
  ["explicit staging deploy guard", deploy.includes("STAGING_ONLY") && deploy.includes("approvedProjectRef") && deploy.includes("database/query") && deploy.includes("functions\", \"deploy")],
  ["transaction-safe policy reconciliation", deploy.includes("makePolicyCreatesIdempotent") && deploy.includes("drop policy if exists") && deploy.includes("begin;\\n${migrationSql}")],
  ["storage DDL preserves Supabase ownership", deploy.includes("getStoragePolicyPlan") && deploy.includes("pg_policies") && deploy.includes("rls_enabled") && deploy.includes("omitVerifiedStorageOwnedDdl") && deploy.includes("missingCreates") && deploy.includes("unsafeDrops")],
  ["missing owner-only policies remain explicit debt", deploy.includes("deferredOwnerMigrations.push") && deploy.includes("missing_storage_owner_policies") && deploy.includes("continue;")],
  ["deployment is scoped to reviewed Voice migrations", deploy.includes("prerequisiteMigrationVersions") && deploy.includes("targetMigrationVersions") && deploy.includes("outOfScopePendingMigrations")],
  ["hosted deploy verifies rate-limit reconciliation", deploy.includes("rate_limit_gate") && deploy.includes("rate_limit_migration_recorded") && deploy.includes("rate_limit_keyword_fix_recorded")],
  ["deploy diagnostics retain redacted failure tail", deploy.includes("[REDACTED_OUTPUT_TRUNCATED]") && deploy.includes("safe.slice(-750)")],
  ["secret server boundary", fn.includes('getRequiredEnv("LIVEKIT_API_SECRET")') && !client.includes("LIVEKIT_API_SECRET")],
];

for (const [label, pass] of checks) {
  if (!pass) throw new Error(`FAIL ${label}`);
  console.log(`PASS ${label}`);
}
console.log("Secure active-member LiveKit token authorization smoke passed.");
