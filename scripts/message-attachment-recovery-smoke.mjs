import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const composer = read("src/components/MessageComposer.tsx");
const metadata = read("src/services/attachmentService.ts");
const upload = read("src/services/uploadService.ts");
const migration = read("supabase/migrations/20260809220000_fix_pending_attachment_metadata_returning_rls.sql");
const edgeFunction = read("supabase/functions/create-message-attachment-upload/index.ts");
const config = read("supabase/config.toml");

assert.match(metadata, /auth\.getUser\(\)/, "metadata must resolve the current authenticated user");
assert.match(metadata, /upload\.userId !== uploaderId/, "metadata must reject an upload/session identity mismatch");
assert.match(upload, /input\.userId\.trim\(\) !== userId/, "signed upload must reject an upload/session identity mismatch");
assert.match(composer, /await uploadService\.removePending\(result\.data\.storagePath\)/, "failed metadata must clean up the protected pending file");
assert.match(migration, /attachments\.message_id is null and attachments\.uploader_id = auth\.uid\(\)/, "own pending attachments must remain selectable for INSERT RETURNING");
assert.match(migration, /on public\.attachments as restrictive[\s\S]*for select/, "fix must preserve the restrictive active-community guard");
for (const marker of ["requireSupabaseUser", "community_members", "channels", "createSignedUploadUrl", "message-attachments", "pending/${auth.user.id}"]) {
  assert.ok(edgeFunction.includes(marker), `secure upload function is missing ${marker}`);
}
assert.match(config, /\[functions\.create-message-attachment-upload\][\s\S]*verify_jwt = true/, "message upload function must enforce JWT validation");

console.log("Message attachment metadata recovery, cleanup, RLS, and signed-upload contracts passed.");
