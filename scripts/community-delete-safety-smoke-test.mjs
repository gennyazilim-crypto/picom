import { readFileSync } from "node:fs";

const service = readFileSync("src/services/communityDeleteSafetyService.ts", "utf8");
const component = readFileSync("src/components/CommunityDeleteSafetyPanel.tsx", "utf8");
const adminSections = readFileSync("src/components/community/CommunityAdminSections.tsx", "utf8");
const migration = readFileSync("supabase/migrations/20260906230000_immediate_community_deletion.sql", "utf8");
const rls = readFileSync("supabase/tests/rls/simplified_deletion_30_day.sql", "utf8");
const failures = [];

for (const marker of ['rpc("delete_owned_community"', "COMMUNITY_IMMEDIATE_DELETION_ENABLED", 'community.deletion.irreversible']) {
  if (!(service + component).includes(marker)) failures.push(`immediate community deletion marker missing: ${marker}`);
}
for (const forbidden of ["localStorage", "reauthenticateCurrentUser", "archiveCommunity", "cancelDeletion", "scheduledAt", "currentPassword"]) {
  if (service.includes(forbidden) || component.includes(forbidden)) failures.push(`legacy community deletion UI remains: ${forbidden}`);
}
for (const marker of ['t("community.danger.ownerOnly")', 't("community.danger.title")', 't("community.danger.description")']) {
  if (!adminSections.includes(marker)) failures.push(`localized community danger-zone header missing: ${marker}`);
}
for (const marker of [
  "delete_owned_community",
  "target.owner_id <> auth.uid()",
  "archived_at = deleted_now",
  "community_invites",
  "secret_community_invites",
  "community_live_screen_sessions",
  "drop function if exists public.finalize_due_community_deletions",
  "revoke all on function public.archive_community",
  "COMMUNITY_DELETION_LIFECYCLE_MANAGED_SERVER_SIDE",
]) {
  if (!migration.includes(marker)) failures.push(`immediate community deletion migration missing: ${marker}`);
}
for (const scenario of ["owner immediately deletes community", "member cannot delete community", "moderator cannot delete community", "foreign user cannot delete community", "deleted community is no longer visible to existing members", "deleted community rejects new joins", "repeated owner delete is safe and cannot restore community"]) {
  if (!rls.includes(scenario)) failures.push(`community RLS coverage missing: ${scenario}`);
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Immediate irreversible community deletion safety contract passed.");
