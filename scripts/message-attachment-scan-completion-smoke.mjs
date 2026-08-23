import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");

const edge = read("supabase/functions/complete-message-attachment-scan/index.ts");
const trigger = read("supabase/migrations/20260809231000_require_scanned_attachments_on_message_send.sql");
const service = read("src/services/attachmentService.ts");
const composer = read("src/components/MessageComposer.tsx");
const grid = read("src/components/AttachmentGrid.tsx");

for (const mime of ["image/png", "image/jpeg", "image/gif", "image/webp"]) {
  assert.ok(edge.includes(`mimeType === "${mime}"`), `missing server-side signature guard for ${mime}`);
}
assert.ok(edge.includes('attachment.uploader_id !== auth.user.id'), "scanner must stay owner-authorized");
assert.ok(edge.includes('update({ scan_status: "clean" })'), "only the server may promote a verified image to clean");
assert.ok(edge.includes('update({ scan_status: "failed" })'), "invalid images must remain blocked");
assert.ok(trigger.includes("new.scan_status not in ('clean', 'skipped_development')"), "message attachment trigger must fail closed");
assert.ok(service.includes('complete-message-attachment-scan'), "client must request the server-side check");
assert.ok(composer.includes("completePendingAttachmentSafetyCheck(metadata.data.id)"), "composer must wait for the scan before marking upload complete");
assert.ok(grid.includes("retrySafetyCheck"), "pending legacy attachment must offer a retry path");

console.log("Message attachment scan completion contract passed.");
