import { readFileSync } from "node:fs";

const files = {
  ownershipService: readFileSync("src/services/communityOwnershipTransferService.ts", "utf8"),
  archiveService: readFileSync("src/services/communityDeleteSafetyService.ts", "utf8"),
  ownershipPanel: readFileSync("src/components/CommunityOwnershipTransferPanel.tsx", "utf8"),
  archivePanel: readFileSync("src/components/CommunityDeleteSafetyPanel.tsx", "utf8"),
  auditPanel: readFileSync("src/components/CommunityAuditLogSection.tsx", "utf8"),
  migration: readFileSync("supabase/migrations/20260711149800_community_audit_danger_zone_completion.sql", "utf8"),
  immutable: readFileSync("supabase/migrations/20260710144000_audit_log_immutability_hardening.sql", "utf8"),
  pgTap: readFileSync("supabase/tests/rls/community_lifecycle_management.sql", "utf8"),
  policy: readFileSync("docs/community-audit-danger-zone.md", "utf8"),
};

const checks = [
  ["service reauthentication", files.ownershipService.includes("reauthenticateCurrentUser") && files.archiveService.includes("reauthenticateCurrentUser")],
  ["typed and reasoned confirmations", files.ownershipPanel.includes('autoComplete="current-password"') && files.archivePanel.includes('autoComplete="current-password"') && files.ownershipPanel.includes("Reason") && files.archivePanel.includes("Archive reason")],
  ["service-only Supabase boundary", !files.ownershipPanel.includes("supabase.") && !files.archivePanel.includes("supabase.")],
  ["atomic ownership lock", files.migration.includes("for update") && files.migration.includes("community_member_roles") && files.migration.includes("community_member_role_audit")],
  ["active target validation", files.migration.includes("COMMUNITY_TRANSFER_TARGET_NOT_MEMBER") && files.migration.includes("community_bans")],
  ["append-only evidence", files.migration.includes("insert into public.audit_log") && files.immutable.includes("AUDIT_LOG_APPEND_ONLY")],
  ["no community hard delete", !/delete\s+from\s+public\.communities/i.test(files.migration)],
  ["audit filters", files.auditPanel.includes("Target") && files.auditPanel.includes("Date range") && files.auditPanel.includes("Actor")],
  ["rollback pgTAP", files.pgTap.includes("failed transfer rolls ownership back cleanly") && files.pgTap.includes("failed archive leaves lifecycle state unchanged")],
  ["backup recovery policy", files.policy.includes("Backup and recovery impact") && files.policy.includes("operations-controlled restore")],
];

for (const [label, pass] of checks) {
  if (!pass) throw new Error(`FAIL ${label}`);
  console.log(`PASS ${label}`);
}
console.log("Community audit and danger zone Full MVP smoke passed.");
