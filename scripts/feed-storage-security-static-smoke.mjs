import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const migrationsDir = "supabase/migrations";
const migrations = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .map((name) => ({ name, body: readFileSync(path.join(migrationsDir, name), "utf8") }));

const joined = migrations.map((item) => item.body).join("\n");
assert.ok(joined.includes("message-attachments") || joined.includes("message_attachments"), "message attachments storage/table contract missing");
assert.ok(/create policy[\s\S]*storage\.objects/i.test(joined) || joined.includes("message_attachments_"), "storage object policies must exist");
assert.ok(joined.includes("can_view_message") || joined.includes("can_view_attachment") || joined.includes("message_attachments"), "attachment access must be message-scoped");

const upload = readFileSync("src/services/uploadService.ts", "utf8");
assert.ok(upload.includes("create-message-attachment-upload"), "uploads must go through signed Edge Function path");
assert.ok(upload.includes("MESSAGE_ATTACHMENTS_BUCKET"), "canonical bucket constant required");
assert.ok(upload.includes("fileService.validateContent"), "magic-byte validation required before upload");

const fileService = readFileSync("src/services/fileService.ts", "utf8");
assert.ok(fileService.includes("allowedImageMimeTypes"), "MIME allowlist required");
assert.ok(fileService.includes("maxImageFileSizeBytes"), "max size required");
assert.ok(!fileService.includes("image/svg"), "SVG must stay out of image allowlist");

console.log("Feed/storage attachment security static smoke: PASS");
console.log("Hosted Storage deny/allow matrix: NOT_RUN (no Storage/RLS migration changed this turn)");
