import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { printMaintenanceResult, requireDevelopmentDefault } from "./lib/maintenance-guards.mjs";

requireDevelopmentDefault("check-storage");

const read = (path) => readFileSync(resolve(path), "utf8");
const migration = read("supabase/migrations/20260711151400_storage_lifecycle_full_mvp.sql");
const cleanup = read("scripts/cleanup-orphaned-uploads.mjs");
const required = [
  "message-attachments", "direct-message-attachments", "profile-media",
  "community-branding", "audio-covers", "podcast-audio",
  "list_storage_orphan_candidates", "service_role",
];
for (const marker of required) if (!migration.includes(marker)) throw new Error(`Storage lifecycle contract is missing ${marker}`);
if (!cleanup.includes("PICOM_CONFIRM_STORAGE_DELETE") || !cleanup.includes("--apply")) throw new Error("Storage cleanup destructive confirmation contract is missing");

printMaintenanceResult("Picom Storage lifecycle contract", {
  mode: "read_only_contract",
  provider: "supabase_storage",
  publicIdentityBuckets: ["profile-media", "community-branding"],
  privateContentBuckets: ["message-attachments", "direct-message-attachments", "audio-covers", "podcast-audio"],
  checks: ["bucket_visibility", "mime_and_size_limits", "path_ownership", "signed_private_access", "cancel_cleanup", "service_role_orphan_inventory"],
});
