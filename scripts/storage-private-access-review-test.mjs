import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path) => readFileSync(resolve(process.cwd(), path), "utf8");
const bucket = read("supabase/migrations/20260704002200_storage_message_attachments_bucket.sql");
const hardening = read("supabase/migrations/20260710121000_multi_tenant_realtime_storage_hardening.sql");
const quarantine = read("supabase/migrations/20260710139000_attachment_scanning_quarantine.sql");
const upload = read("src/services/uploadService.ts");
const metadata = read("src/services/attachmentService.ts");
const hosted = read("scripts/hosted-staging-rls-validation.mjs");
const docs = read("docs/attachment-delivery.md");
const lifecycle = read("supabase/migrations/20260711151400_storage_lifecycle_full_mvp.sql");
const lifecycleDocs = read("docs/supabase-storage-lifecycle.md");

const checks = [
  [bucket.includes("'message-attachments'") && /\n\s*false,\s*\n\s*10485760/.test(bucket), "private bucket with size limit"],
  [hardening.includes('public.can_view_message(attachment.message_id)'), "private-channel visibility hardening"],
  [quarantine.includes('message attachments read scanned visible object'), "latest Storage SELECT policy"],
  [quarantine.includes("attachment.scan_status in ('clean','skipped_development')"), "fail-closed scan gate"],
  [quarantine.includes('public.can_view_message(attachment.message_id)'), "latest policy preserves message visibility"],
  [upload.includes("publicUrl: null") && !upload.includes("getPublicUrl(") && !upload.includes("createSignedUrl("), "upload does not publish objects"],
  [metadata.includes("public_url: null") && metadata.includes("never an expiring signed URL"), "metadata does not persist signed URL"],
  [hosted.includes("PICOM_RLS_PRIVATE_ATTACHMENT_ID") && hosted.includes("PICOM_RLS_PRIVATE_STORAGE_PATH"), "hosted metadata and object leak matrix"],
  [docs.includes("Review conclusion - 2026-07-10") && docs.includes("Historical private attachment reload"), "documented delivery decision and blocker"],
  [lifecycle.includes("list_storage_orphan_candidates") && lifecycle.includes("to service_role"), "service-role-only orphan inventory"],
  [/\('podcast-audio'\s*,\s*'podcast-audio'\s*,\s*false/.test(lifecycle) && /\('direct-message-attachments'\s*,\s*'direct-message-attachments'\s*,\s*false/.test(lifecycle), "private DM and Podcast buckets"],
  [lifecycleDocs.includes("Public identity assets") && lifecycleDocs.includes("Private content buckets"), "explicit public/private Storage classification"],
];

const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);
if (failed.length) throw new Error(`Storage private access review failed: ${failed.join(", ")}`);

console.log("Storage private bucket, message visibility, scan gate, non-persistence, and hosted leak checks passed.");
