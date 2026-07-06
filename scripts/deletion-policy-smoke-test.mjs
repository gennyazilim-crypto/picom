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
  "Soft Delete and Restore Policy",
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

for (const expected of ["deleted_at", ".update({", ".is(\"deleted_at\", null)"]) {
  assertIncludes(messageDelete, expected, "message delete mutation");
}

assertIncludes(messageList, ".is(\"deleted_at\", null)", "message list query");
assertIncludes(communityDelete, "soft deletion with `deletedAt`", "community delete placeholder docs");
assertIncludes(auditLog, "append-only", "audit log immutability docs");

console.log("Soft delete and restore policy smoke test passed.");

