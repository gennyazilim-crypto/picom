import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assertIncludes(text, expected, label) {
  if (!text.includes(expected)) {
    throw new Error(`${label} missing expected content: ${expected}`);
  }
}

function assertNotMatches(text, pattern, label) {
  if (pattern.test(text)) {
    throw new Error(`${label} contains forbidden pattern: ${pattern}`);
  }
}

const index = read("packages/shared/src/index.ts");
const dto = read("packages/shared/src/dto/index.ts");
const permissions = read("packages/shared/src/permissions/index.ts");
const events = read("packages/shared/src/events/index.ts");
const docs = read("docs/shared-types.md");
const combined = [
  index,
  dto,
  permissions,
  events,
  read("packages/shared/src/types/api.ts"),
  read("packages/shared/src/types/pagination.ts"),
  read("packages/shared/src/dto/user.ts"),
  read("packages/shared/src/dto/message.ts"),
].join("\n");

for (const expected of [
  "UserDTO",
  "CommunityDTO",
  "ChannelDTO",
  "MessageDTO",
  "AttachmentDTO",
  "MemberDTO",
  "RoleDTO",
  "NotificationDTO",
  "PermissionKey",
  "ApiErrorDTO",
  "PaginatedResponse",
  "RealtimeEvent",
]) {
  assertIncludes(combined + docs, expected, "shared types package");
}

for (const forbidden of [
  /passwordHash/i,
  /tokenHash/i,
  /access_token/i,
  /refresh_token/i,
  /service_role/i,
  /LiveKit API secret/i,
]) {
  assertNotMatches(combined, forbidden, "shared type definitions");
}

console.log("Shared types package smoke test passed.");
