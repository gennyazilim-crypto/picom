import { readFileSync } from "node:fs";

const service = readFileSync("src/services/communityDeleteSafetyService.ts", "utf8");
const component = readFileSync("src/components/CommunityDeleteSafetyPanel.tsx", "utf8");
const migration = readFileSync("supabase/migrations/20260906120000_simplified_30_day_deletion.sql", "utf8");
const rls = readFileSync("supabase/tests/rls/simplified_deletion_30_day.sql", "utf8");
const failures = [];

for (const marker of ['rpc("request_community_deletion"', 'rpc("cancel_community_deletion"', 'rpc("get_community_deletion_status"']) {
  if (!service.includes(marker)) failures.push(`community deletion RPC missing: ${marker}`);
}
for (const forbidden of ["localStorage", "reauthenticateCurrentUser", "archiveCommunity", "confirmationName", "currentPassword"]) {
  if (service.includes(forbidden) || component.includes(forbidden)) failures.push(`legacy community deletion UI remains: ${forbidden}`);
}
for (const marker of [
  "scheduled_deletion_at",
  "request_community_deletion",
  "cancel_community_deletion",
  "finalize_due_community_deletions",
  "community_deletion_requested",
  "community_deletion_cancelled",
  "COMMUNITY_DELETION_PENDING",
]) {
  if (!migration.includes(marker)) failures.push(`community lifecycle migration missing: ${marker}`);
}
for (const scenario of ["owner schedules a 30-day deletion", "member cannot request community deletion", "moderator cannot request community deletion", "owner can cancel own pending deletion", "service finalizer is idempotent tombstone cleanup"]) {
  if (!rls.includes(scenario)) failures.push(`community RLS coverage missing: ${scenario}`);
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Community 30-day deletion safety contract passed.");
