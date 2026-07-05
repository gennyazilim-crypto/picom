import { printMaintenanceResult, requireDevelopmentDefault } from "./lib/maintenance-guards.mjs";

requireDevelopmentDefault("check-storage");

printMaintenanceResult("Storage provider check placeholder", {
  mode: "read_only_placeholder",
  provider: process.env.STORAGE_PROVIDER ?? "local_or_supabase_placeholder",
  bucket: process.env.SUPABASE_STORAGE_BUCKET ?? "picom-attachments",
  checks: ["configuration_present", "upload_limits_documented", "delete_api_placeholder"],
});
