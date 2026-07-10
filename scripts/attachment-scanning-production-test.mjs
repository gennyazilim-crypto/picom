import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const scan = readFileSync(resolve(root, "src/services/attachmentScanService.ts"), "utf8");
const quarantine = readFileSync(resolve(root, "src/services/attachmentQuarantineService.ts"), "utf8");
const migration = readFileSync(resolve(root, "supabase/migrations/20260710139000_attachment_scanning_quarantine.sql"), "utf8");
const doc = readFileSync(resolve(root, "docs/attachment-scanning-production.md"), "utf8");

for (const state of ["pending", "clean", "suspicious", "failed"]) assert.ok(scan.includes(`"${state}"`), `Missing scan state: ${state}`);
for (const state of ["suspicious", "failed"]) assert.ok(quarantine.includes(`"${state}"`), `Missing quarantine state: ${state}`);
assert.ok(migration.includes("attachment.scan_status in ('clean','skipped_development')"), "Storage reads must fail closed");
assert.ok(migration.includes("revoke insert, update on table public.attachments"), "Uploaders must not self-mark clean");

for (const unsafe of ["child_process", "exec(", "spawn(", "shell:", "eval("]) {
  assert.equal(scan.includes(unsafe), false, `Scanner abstraction must not execute files: ${unsafe}`);
}

for (const marker of ["No paid provider", "Do not execute uploaded files", "service-role", "fail closed", "Edge Function"]) {
  assert.ok(doc.includes(marker), `Missing production scanning documentation: ${marker}`);
}

console.log("Attachment production scanning contract tests passed.");
