import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const migration = read("supabase/migrations/20260717120000_secret_community_production.sql");
const verification = read("supabase/functions/secret-community-verification/index.ts");
const selfHostedMigration = read("supabase/migrations/20260717223000_self_hosted_secret_voice_verification.sql");
const secretService = read("src/services/community/secretCommunityService.ts");
const discovery = read("src/services/communityDiscoveryService.ts") + read("src/services/discoveryModerationService.ts");
const flow = read("src/components/SecretCommunityFlows.tsx");
const rootOps = read("src/services/rootDashboard/secretCommunityOperationsService.ts");

const checks = [
  ["secret visibility constraint", /visibility in \('public','private','secret'\)/i.test(migration)],
  ["hashed unique phone", /phone_hash text unique check\(phone_hash is null or phone_hash~'\^\[a-f0-9\]\{64\}\$'\)/.test(migration)],
  ["voice verification provider", selfHostedMigration.includes("'picom_self_hosted_voice_v1'")],
  ["recipient-bound invite", migration.includes("recipient_user_id uuid not null")],
  ["exact one-hour expiry", migration.includes("check(expires_at=created_at+interval '1 hour')")],
  ["maximum five uses", migration.includes("max_uses smallint not null default 5 check(max_uses=5)")],
  ["hash-only invitation credential", migration.includes("credential_hash text not null unique")],
  ["raw invitation not persisted in automatic delivery", !migration.includes("invitation_link:='picom://invite/'||raw_credential")],
  ["recipient UUID automatic delivery", migration.includes("invitation_link:='picom://invite/'||invite.id::text")],
  ["raw credential returned only once", (migration.match(/'code',raw_credential/g) ?? []).length === 1],
  ["secret tables use RLS", migration.includes("alter table public.account_security_verifications enable row level security") && migration.includes("execute format('alter table public.%I enable row level security'")],
  ["immutable security audit", migration.includes("immutable_secret_audit_change")],
  ["leave revokes access", migration.includes("revoke_secret_invites_after_leave")],
  ["wrong recipient rejected", migration.includes("invite.recipient_user_id<>auth.uid()")],
  ["warnings and rules required", migration.includes("SECRET_WARNING_ACCEPTANCE_REQUIRED") && migration.includes("COMMUNITY_RULES_ACCEPTANCE_REQUIRED")],
  ["global search exclusion", migration.includes("where r.community_id is null or not public.is_secret_community(r.community_id)")],
  ["mention and profile exclusion", migration.includes("is_secret_community") && migration.includes("list_visible_profile_activity_pre_secret")],
  ["root-only trust operations", migration.includes("adjust_root_secret_community_trust_score") && migration.includes("is_root_owner()")],
  ["Picom self-hosted call gateway", verification.includes("PICOM_VOICE_VERIFY_BASE_URL") && verification.includes("x-picom-signature")],
  ["HMAC phone protection", verification.includes('name: "HMAC"') && verification.includes("PHONE_VERIFICATION_HASH_SECRET")],
  ["E.164 validation", verification.includes("^\\+[1-9][0-9]{7,14}$")],
  ["UUID and raw-code invite parsing", secretService.includes("[a-fA-F0-9]{64}|[0-9a-fA-F]{8}-[0-9a-fA-F-]{27}")],
  ["discovery is public-only", !discovery.includes('visibility !== "private"') && discovery.includes('visibility === "public"')],
  ["join security UX", flow.includes("Security warnings") && flow.includes("Community rules") && flow.includes("SecretCommunityEligibilityPanel")],
  ["root operations service", rootOps.includes("list_root_secret_communities") && rootOps.includes("adjust_root_secret_community_trust_score")],
];

for (const [label, passed] of checks) {
  assert.equal(passed, true, label);
  console.log("PASS " + label);
}
console.log("PASS Secret Community production security contract completed");
