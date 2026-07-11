import { readFileSync } from "node:fs";

const badgeMigration = readFileSync("supabase/migrations/20260710195000_profile_verification_badges.sql", "utf8");
const securityMigration = readFileSync("supabase/migrations/20260710249000_verification_schema_security.sql", "utf8");
const workflowMigration = readFileSync("supabase/migrations/20260710250000_verification_request_review_mvp.sql", "utf8");
const rlsTest = readFileSync("supabase/tests/rls/verification_security.sql", "utf8");
const view = readFileSync("src/components/VerificationBadgeList.tsx", "utf8");
const admin = readFileSync("src/components/ProfileVerificationAdmin.tsx", "utf8");
const verificationTypes = readFileSync("src/types/verification.ts", "utf8");
const verificationHelpers = readFileSync("src/utils/verificationHelpers.ts", "utf8");
const verifiedBadge = readFileSync("src/components/VerifiedBadge.tsx", "utf8");
const verifiedAvatar = readFileSync("src/components/VerifiedAvatarFrame.tsx", "utf8");
const verificationTooltip = readFileSync("src/components/VerificationBadgeTooltip.tsx", "utf8");
const directMessages = readFileSync("src/components/DirectMessagesView.tsx", "utf8");
const directMessageTypes = readFileSync("src/types/directMessages.ts", "utf8");
const app = readFileSync("src/App.tsx", "utf8");
const styles = readFileSync("src/styles.css", "utf8");

for (const marker of ["verification_badges", "verification_badge_audit", "APP_ADMIN_REQUIRED", "grant_verification_badge", "revoke_verification_badge", "validate_verification_subject", "revoke all on function"]) {
  if (!badgeMigration.includes(marker)) throw new Error(`Missing verification marker: ${marker}`);
}
for (const marker of ["profile_verifications", "community_verifications", "verification_audit_logs", "app_trust_roles", "can_review_verifications", "profile_verifications_self_request", "community_verifications_owner_admin_request", "review_profile_verification", "review_community_verification", "grant insert (user_id, type, reason)"]) {
  if (!securityMigration.includes(marker)) throw new Error(`Missing verification security marker: ${marker}`);
}
for (const type of ["verified_user", "official_community", "picom_staff", "verified_bot", "creator_verified"]) {
  if (!securityMigration.includes(type)) throw new Error(`Missing verification type: ${type}`);
}
for (const marker of ["request_profile_verification", "request_community_verification", "get_own_profile_verification_requests", "list_verification_review_requests", "review_verification_request", "decision_reason", "No identity-document upload", "Identity-document upload and paid verification are intentionally unsupported"]) {
  if (!workflowMigration.includes(marker)) throw new Error(`Missing verification workflow marker: ${marker}`);
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
for (const status of ["none", "pending", "approved", "rejected", "revoked"]) {
  if (!verificationTypes.includes(`\"${status}\"`)) throw new Error(`Missing canonical verification status: ${status}`);
}
for (const helper of ["isApprovedVerification", "getVerificationType", "getVerificationLabel", "getVerificationIcon", "getUserVerificationSummary", "getCommunityVerificationSummary"]) {
  if (!verificationHelpers.includes(helper)) throw new Error(`Missing centralized verification helper: ${helper}`);
}
if (!verificationHelpers.includes('verification?.status === "approved"')) throw new Error("Public verification is not restricted to approved status");
for (const fixture of ["pending", "rejected", "revoked", "approvedUser", "staff", "officialCommunity"]) {
  if (!verificationHelpers.includes(`${fixture}:`)) throw new Error(`Missing verification fixture: ${fixture}`);
}
if (!verifiedBadge.includes('<svg className="verified-badge-glyph"')) throw new Error("Verified badge does not use the internal check SVG");
if (verifiedBadge.includes("title={label}")) throw new Error("Verified badge must not combine native title with the custom tooltip");
if (!verifiedBadge.includes('event.key === "Escape"')) throw new Error("Verified badge tooltip lacks Escape handling");
if (!verificationTooltip.includes("createPortal") || !verificationTooltip.includes("document.body")) throw new Error("Verified tooltip is not rendered in the viewport overlay layer");
if (!verifiedAvatar.includes('verifiedType && size === "profile"')) throw new Error("Verified aura is not restricted to profile avatars");
if (directMessageTypes.includes("participantVerified")) throw new Error("DM verification still has a conflicting boolean source");
if (directMessages.includes("participantVerified") || directMessages.includes("verifiedType=")) throw new Error("DM still derives verification from legacy props");
if (!directMessages.includes("<VerifiedBadge verification={verification}")) throw new Error("DM name rows do not render canonical verification badges");
if (!directMessages.includes('size={compact ? "compact" : "medium"}')) throw new Error("DM avatar variants do not separate compact and medium contexts");
for (const marker of ["command-result-label", "getUserVerificationSummary", "getCommunityVerificationSummary", "verification={result.verification}"]) if (!app.includes(marker)) throw new Error(`Search verification integration is missing ${marker}`);
if (!styles.includes(".verified-avatar-ring-subtle") || !styles.includes("display: none")) throw new Error("Compact and medium aura defense is missing");
console.log("Verification schema and security smoke test passed.");
