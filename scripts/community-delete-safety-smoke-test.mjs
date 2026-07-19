import { readFileSync } from "node:fs";

const service = readFileSync("src/services/communityDeleteSafetyService.ts", "utf8");
const component = readFileSync("src/components/CommunityDeleteSafetyPanel.tsx", "utf8");
const migration = ["supabase/migrations/20260711000800_community_lifecycle_management.sql", "supabase/migrations/20260711149800_community_audit_danger_zone_completion.sql"].map((file) => readFileSync(file, "utf8")).join("\n");
const test = readFileSync("supabase/tests/rls/community_lifecycle_management.sql", "utf8");

const failures = [];
for (const marker of ["Only the community owner", "confirmationName.trim() !== community.name", "reauthenticateCurrentUser", 'rpc("archive_community"', 'status: "archived"', "append-only audit history were retained"]) if (!service.includes(marker)) failures.push(`archive service missing: ${marker}`);
for (const marker of ["archived_at timestamptz", "archive_community", "COMMUNITY_ARCHIVE_OWNER_REQUIRED", "active communities are visible", "community_archive", "discovery_listed = false"]) if (!migration.includes(marker)) failures.push(`archive migration missing: ${marker}`);
for (const marker of ["Archive community", "Verifying and archiving", "without hard-deleting content", "current-password"]) if (!component.includes(marker)) failures.push(`archive UI missing: ${marker}`);
for (const scenario of ["previous owner cannot archive after transfer", "archive requires exact community name", "failed archive leaves lifecycle state unchanged", "current owner can archive without hard deletion", "archive retains child data for controlled recovery"]) if (!test.includes(scenario)) failures.push(`archive pgTAP missing: ${scenario}`);
if (/delete\s+from\s+public\.communities/i.test(migration)) failures.push("Community archive migration must not hard-delete community rows.");
for (const legacyMarker of ["soft_delete_placeholder", "requestSoftDeletePlaceholder", "Owner-only soft delete placeholder", "The community was not deleted"]) {
  if (service.includes(legacyMarker) || component.includes(legacyMarker)) failures.push(`Community archive still contains legacy marker: ${legacyMarker}`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Community archive safety production smoke passed.");
