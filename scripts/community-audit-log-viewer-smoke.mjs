import fs from "node:fs";
const viewer = fs.readFileSync("src/components/CommunityAuditLogSection.tsx", "utf8");
const menu = fs.readFileSync("src/components/CommunityMenu.tsx", "utf8");
const immutable = fs.readFileSync("supabase/migrations/20260710144000_audit_log_immutability_hardening.sql", "utf8");
for (const needle of ["getActorLabel", "getTargetLabel", "formatFullTimestamp", "No reason provided", "exportForAdmin"]) if (!viewer.includes(needle)) throw new Error(`Audit viewer is missing ${needle}`);
if (!menu.includes("access.isOwner || access.isAdmin")) throw new Error("Audit viewer is not owner/admin gated.");
for (const needle of ["revoke insert, update, delete, truncate", "AUDIT_LOG_APPEND_ONLY", "redact_audit_reason"]) if (!immutable.includes(needle)) throw new Error(`Audit immutability is missing ${needle}`);
if (/deleteRecord|updateRecord|editAudit/i.test(viewer)) throw new Error("Audit viewer exposes a mutation path.");
console.log("Community audit log viewer smoke passed.");
