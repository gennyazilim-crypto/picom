import { readFileSync } from "node:fs";

const badgeMigration = readFileSync("supabase/migrations/20260710195000_profile_verification_badges.sql", "utf8");
const securityMigration = readFileSync("supabase/migrations/20260710249000_verification_schema_security.sql", "utf8");
const rlsTest = readFileSync("supabase/tests/rls/verification_security.sql", "utf8");
const view = readFileSync("src/components/VerificationBadgeList.tsx", "utf8");
const admin = readFileSync("src/components/ProfileVerificationAdmin.tsx", "utf8");

for (const marker of ["verification_badges", "verification_badge_audit", "APP_ADMIN_REQUIRED", "grant_verification_badge", "revoke_verification_badge", "validate_verification_subject", "revoke all on function"]) {
  if (!badgeMigration.includes(marker)) throw new Error(`Missing verification marker: ${marker}`);
}
for (const marker of ["profile_verifications", "community_verifications", "verification_audit_logs", "app_trust_roles", "can_review_verifications", "profile_verifications_self_request", "community_verifications_owner_admin_request", "review_profile_verification", "review_community_verification", "grant insert (user_id, type, reason)"]) {
  if (!securityMigration.includes(marker)) throw new Error(`Missing verification security marker: ${marker}`);
}
for (const type of ["verified_user", "official_community", "picom_staff", "verified_bot", "creator_verified"]) {
  if (!securityMigration.includes(type)) throw new Error(`Missing verification type: ${type}`);
}
for (const scenario of ["user cannot self-approve verification", "approved verification is readable", "non-reviewer cannot review verification", "verification decision creates audit log"]) {
  if (!rlsTest.includes(scenario)) throw new Error(`Missing verification RLS scenario: ${scenario}`);
}
for (const claim of ["legal identity", "safety", "quality", "endorsement", "payment", "reputation guarantee"]) {
  if (!badgeMigration.includes(claim)) throw new Error(`Missing non-claim guardrail: ${claim}`);
}
if (!securityMigration.includes("Never store identity documents")) throw new Error("Identity-document storage guardrail is missing.");
if (!view.includes("not a legal identity, safety, quality, or endorsement guarantee")) throw new Error("Badge UI lacks scope disclaimer");
if (!admin.includes("App admin") && !admin.includes("app_admin")) throw new Error("Admin-only badge surface missing");
console.log("Verification schema and security smoke test passed.");
