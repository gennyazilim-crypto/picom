import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const service = readFileSync(resolve(root, "src/services/auditLogService.ts"), "utf8");
const section = readFileSync(resolve(root, "src/components/CommunityAuditLogSection.tsx"), "utf8");
const migration = readFileSync(resolve(root, "supabase/migrations/20260710144000_audit_log_immutability_hardening.sql"), "utf8");

for (const marker of ["sanitizeAuditRecord", "sanitizeAuditIdentifier", "AUDIT_SECRET_PATTERN", "exportForAdmin", "MAX_EXPORT_RECORDS"]) {
  assert.ok(service.includes(marker), `Missing safe audit service marker: ${marker}`);
}
assert.ok(service.includes("if (!canExport)"), "Export must enforce permission");
assert.ok(section.includes("auditLogService.exportForAdmin(filtered, canView)"), "Review UI must use permission-checked export");
assert.ok(section.includes("disabled={exportDisabled}"), "Unauthorized/empty export controls must be disabled");
assert.equal(/\.from\("audit_log"\)\.(update|delete)/.test(service), false, "Audit service must not mutate existing records");
assert.ok(migration.includes("audit_log_append_only"), "Database append-only trigger must remain present");

console.log("Audit log admin review and export contract tests passed.");
