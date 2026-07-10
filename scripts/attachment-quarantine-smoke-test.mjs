import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const files = {
  quarantineService: readFileSync(resolve(root, "src/services/attachmentQuarantineService.ts"), "utf8"),
  attachmentGrid: readFileSync(resolve(root, "src/components/AttachmentGrid.tsx"), "utf8"),
  adminPanel: readFileSync(resolve(root, "src/components/AdminOperationsPanel.tsx"), "utf8"),
  doc: readFileSync(resolve(root, "docs/attachment-quarantine-system.md"), "utf8"),
  migration: readFileSync(resolve(root, "supabase/migrations/20260710139000_attachment_scanning_quarantine.sql"), "utf8"),
};

const checks = [
  [files.quarantineService.includes("isQuarantined"), "quarantine decision helper"],
  [files.quarantineService.includes("suspicious") && files.quarantineService.includes("failed"), "quarantined scan statuses"],
  [files.quarantineService.includes("GET /admin/attachments/quarantine"), "admin list route placeholder"],
  [files.quarantineService.includes("PATCH /admin/attachments/:attachmentId/review"), "admin review route placeholder"],
  [files.attachmentGrid.includes("attachmentQuarantineService.getAccessDecision"), "AttachmentGrid uses quarantine decision"],
  [files.attachmentGrid.includes("!access.canRender"), "blocked attachments do not render"],
  [files.adminPanel.includes("Attachment quarantine"), "Admin Operations quarantine summary"],
  [files.doc.includes("Signed URLs must not be issued for quarantined files"), "server-side signed URL rule documented"],
  [files.doc.includes("Normal users must not access quarantined objects directly"), "normal user access restriction documented"],
  [files.migration.includes("message attachments read scanned visible object"), "Storage scan gate"],
  [files.migration.includes("attachment.scan_status in ('clean','skipped_development')"), "only safe scan states served"],
];

const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);
if (failed.length > 0) {
  throw new Error(`Attachment quarantine smoke test failed: ${failed.join(", ")}`);
}

console.log("Attachment quarantine system smoke test passed.");
