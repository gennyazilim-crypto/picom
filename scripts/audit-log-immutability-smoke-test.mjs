import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const files = {
  doc: readFileSync(resolve(root, "docs/audit-log-immutability.md"), "utf8"),
  hardeningDoc: readFileSync(resolve(root, "docs/audit/audit-log-immutability-hardening.md"), "utf8"),
  auditService: readFileSync(resolve(root, "src/services/auditLogService.ts"), "utf8"),
  migration: readFileSync(resolve(root, "supabase/migrations/20260710144000_audit_log_immutability_hardening.sql"), "utf8"),
};

const checks = [
  [files.doc.includes("append-only"), "append-only policy"],
  [files.doc.includes("direct client-side `update`"), "client update disallowed"],
  [files.doc.includes("direct client-side `delete`"), "client delete disallowed"],
  [files.doc.includes("passwords"), "password exclusion"],
  [files.doc.includes("session tokens"), "session token exclusion"],
  [files.doc.includes("authorization headers"), "authorization header exclusion"],
  [files.doc.includes("security definer"), "trusted write function guidance"],
  [files.doc.includes("on delete set null"), "cascade delete protection"],
  [files.hardeningDoc.toLowerCase().includes("append-only"), "hardening append-only policy"],
  [files.hardeningDoc.includes("Export policy"), "bounded export policy"],
  [files.hardeningDoc.includes("Retention"), "retention policy"],
  [files.auditService.includes("AUDIT_SECRET_PATTERN"), "audit service redaction"],
  [files.auditService.includes("formatVersion: 1"), "bounded export format"],
  [files.migration.includes("audit_log_append_only"), "database append-only trigger"],
  [files.migration.includes("revoke insert, update, delete, truncate"), "explicit mutation privilege revocation"],
];

const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);
if (failed.length > 0) {
  throw new Error(`Audit log immutability smoke test failed: ${failed.join(", ")}`);
}

console.log("Audit log immutability smoke test passed.");
