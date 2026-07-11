import { readFileSync } from "node:fs";

const service = readFileSync("src/services/communityOwnershipTransferService.ts", "utf8");
const component = readFileSync("src/components/CommunityOwnershipTransferPanel.tsx", "utf8");
const migration = ["supabase/migrations/20260711000800_community_lifecycle_management.sql", "supabase/migrations/20260711149800_community_audit_danger_zone_completion.sql"].map((file) => readFileSync(file, "utf8")).join("\n");
const test = readFileSync("supabase/tests/rls/community_lifecycle_management.sql", "utf8");

const failures = [];
for (const marker of ["Only the current owner", "confirmationName.trim() !== community.name", "Target user must be a current community member", "reauthenticateCurrentUser", "transfer_reason", 'rpc("transfer_community_ownership"', 'status: "completed"']) {
  if (!service.includes(marker)) failures.push(`ownership service missing: ${marker}`);
}
for (const marker of ["transfer_community_ownership", "for update", "COMMUNITY_TRANSFER_OWNER_REQUIRED", "COMMUNITY_TRANSFER_TARGET_NOT_MEMBER", "ownership_transfer", "community_member_roles", "set owner_id = target_new_owner_id"]) {
  if (!migration.toLowerCase().includes(marker.toLowerCase())) failures.push(`ownership migration missing: ${marker}`);
}
for (const marker of ["Transfer ownership", "Verifying and transferring...", "current-password", "role=\"alert\""]) if (!component.includes(marker)) failures.push(`ownership UI missing: ${marker}`);
for (const scenario of ["non-owner cannot transfer ownership", "ownership target must be a current member", "failed transfer rolls ownership back cleanly", "owner can transfer ownership atomically", "new owner receives Owner role", "previous owner receives safe non-owner role"]) if (!test.includes(scenario)) failures.push(`ownership pgTAP missing: ${scenario}`);
for (const legacyMarker of ["pending_placeholder", "requestTransferPlaceholder", "Owner-only placeholder", "No roles change yet"]) {
  if (service.includes(legacyMarker) || component.includes(legacyMarker)) failures.push(`Ownership transfer still contains legacy marker: ${legacyMarker}`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Community ownership transfer production smoke passed.");
