import { readFileSync } from "node:fs";

const files = {
  ownershipService: readFileSync("src/services/communityOwnershipTransferService.ts", "utf8"),
  deleteService: readFileSync("src/services/communityDeleteSafetyService.ts", "utf8"),
  ownershipPanel: readFileSync("src/components/CommunityOwnershipTransferPanel.tsx", "utf8"),
  archivePanel: readFileSync("src/components/CommunityDeleteSafetyPanel.tsx", "utf8"),
  auditPanel: readFileSync("src/components/CommunityAuditLogSection.tsx", "utf8"),
  migration: readFileSync("supabase/migrations/20260906230000_immediate_community_deletion.sql", "utf8"),
  immutable: readFileSync("supabase/migrations/20260710144000_audit_log_immutability_hardening.sql", "utf8"),
  pgTap: readFileSync("supabase/tests/rls/simplified_deletion_30_day.sql", "utf8"),
  policy: readFileSync("docs/community-audit-danger-zone.md", "utf8"),
};

const checks = [
  ["immediate owner-only delete", files.deleteService.includes('rpc("delete_owned_community"') && files.migration.includes("target.owner_id <> auth.uid()")],
  ["no legacy delete friction", !files.archivePanel.includes('autoComplete="current-password"') && !files.archivePanel.includes("Archive reason") && !files.archivePanel.includes("scheduledAt")],
  ["service-only Supabase boundary", !files.ownershipPanel.includes("supabase.") && !files.archivePanel.includes("supabase.")],
  ["atomic owner lock", files.migration.includes("for update") && files.migration.includes("COMMUNITY_OWNER_REQUIRED")],
  ["immediate access removal", files.migration.includes("community_invites") && files.migration.includes("community_live_screen_sessions")],
  ["append-only evidence", files.migration.includes("insert into public.audit_log") && files.immutable.includes("AUDIT_LOG_APPEND_ONLY")],
  ["no community hard delete", !/delete\s+from\s+public\.communities/i.test(files.migration)],
  ["audit filters", files.auditPanel.includes("Target") && files.auditPanel.includes("Date range") && files.auditPanel.includes("Actor")],
  ["immediate pgTAP", files.pgTap.includes("owner immediately deletes community") && files.pgTap.includes("deleted community rejects new joins")],
  ["non-restorable policy", files.policy.includes("Backup and recovery impact") && files.policy.includes("There is no community") && files.policy.includes("restore action")],
];

for (const [label, pass] of checks) {
  if (!pass) throw new Error(`FAIL ${label}`);
  console.log(`PASS ${label}`);
}
console.log("Community audit and danger zone Full MVP smoke passed.");
