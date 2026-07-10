import { readFileSync } from "node:fs";
const migration=readFileSync("supabase/migrations/20260710192000_discovery_moderation_review_hardening.sql","utf8");
const service=readFileSync("src/services/discoveryModerationService.ts","utf8");
const view=readFileSync("src/components/DiscoveryReviewQueue.tsx","utf8");
for(const marker of ["discovery_content_flags","requeue_discovery_listing_on_profile_change","status='pending'","APP_ADMIN_REQUIRED","DISCOVERY_CATEGORY_REQUIRED","reports_submission_rate_limit","submission_count>5","report_submission_rate_limits"]){if(!migration.includes(marker))throw new Error(`Missing discovery moderation marker: ${marker}`);}
for(const forbidden of ["report.description","report.reporter_id","message.body","attachment.storage_path"]){if(migration.includes(forbidden))throw new Error(`Unsafe review queue projection: ${forbidden}`);}
if(!service.includes("contentFlags")||!view.includes("Content flags:"))throw new Error("Content flags are not surfaced in the restricted review UI.");
console.log("Discovery moderation hardening smoke test passed.");
