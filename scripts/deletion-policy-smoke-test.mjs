import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assertIncludes(text, expected, label) {
  if (!text.includes(expected)) {
    throw new Error(`${label} missing expected content: ${expected}`);
  }
}

const doc = read("docs/deletion-policy.md");
const messageDelete = read("src/services/messageDeleteMutation.ts");
const messageList = read("src/services/messageListQuery.ts");
const communityDelete = read("docs/community-delete-safety-placeholder.md");
const auditLog = read("docs/audit-log-immutability.md");

for (const expected of [
  "Deletion and retention policy",
  "Hard-deleted",
  "Soft-deleted",
  "Archived",
  "Never deleted by normal app flows",
  "Messages",
  "Channels",
  "Communities",
  "Users/profiles",
  "Attachments",
  "Invites",
  "Roles",
  "Reports",
  "Notifications",
  "Audit logs",
  "Confirmation requirements",
  "Restore requirements",
  "Current gaps",
]) {
  assertIncludes(doc, expected, "deletion policy");
}

for (const expected of ["deleted_at", 'client.rpc("delete_message_with_version"', "expected_edited_at", "MESSAGE_DELETE_FORBIDDEN"]) {
  assertIncludes(messageDelete, expected, "message delete mutation");
}

assertIncludes(messageList, "deleted_at", "message list query");
assertIncludes(messageList, "deletedAt: row.deleted_at", "message list tombstone mapping");
for (const expected of ["immediate, irreversible", "delete_owned_community", "no password", "scheduled deletion date"]) {
  assertIncludes(communityDelete, expected, "community deletion policy");
}
assertIncludes(auditLog, "append-only", "audit log immutability docs");

console.log("Soft delete and restore policy smoke test passed.");
