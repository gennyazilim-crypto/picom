import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const migration = read("supabase/migrations/20260711151400_storage_lifecycle_full_mvp.sql");
const cleanup = read("scripts/cleanup-orphaned-uploads.mjs");
const check = read("scripts/check-storage.mjs");
const upload = read("src/services/uploadService.ts");
const branding = read("src/services/communityBrandingService.ts");
const radio = read("src/services/audio/radioCoverService.ts");
const podcast = read("src/services/audio/podcastPublishingService.ts");
const profile = read("src/services/profileMediaService.ts");
const direct = read("src/services/directMessages/directAttachmentUploadService.ts");

for (const bucket of ["message-attachments","direct-message-attachments","audio-covers","podcast-audio","profile-media","community-branding"]) assert.ok(migration.includes(`'${bucket}'`),`missing bucket contract: ${bucket}`);
assert.ok(migration.includes("to service_role") && migration.includes("from public,anon,authenticated"),"orphan inventory privilege boundary missing");
assert.ok(migration.includes("unlinked_dm_attachment") && migration.includes("unreferenced_podcast_audio"),"cross-feature orphan inventory missing");
assert.ok(cleanup.includes("--apply") && cleanup.includes("PICOM_CONFIRM_STORAGE_DELETE === \"DELETE_ORPHANS\""),"destructive cleanup confirmation missing");
assert.ok(!check.includes("read_only_placeholder") && check.includes("read_only_contract"),"storage check must be a real structural contract");
assert.ok(upload.includes("if (!error) await configured.data.storage.from(MESSAGE_ATTACHMENTS_BUCKET).remove([storagePath])"),"Text cancel cleanup missing");
assert.ok(upload.includes("removePending(storagePath"),"Text explicit delete path missing");
for (const service of [branding,radio,podcast,profile,direct]) assert.ok(service.includes("signal") || service.includes("remove"),"upload lifecycle service lacks cancel/delete contract");
assert.ok(!podcast.includes("getPublicUrl("),"Podcast private media must not use public URLs");
assert.ok(!direct.includes("getPublicUrl("),"DM private media must not use public URLs");

console.log("Supabase Storage buckets, access, and upload lifecycle smoke: PASS");
