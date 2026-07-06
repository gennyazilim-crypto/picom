import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assertIncludes(text, expected, label) {
  if (!text.includes(expected)) {
    throw new Error(`${label} missing expected content: ${expected}`);
  }
}

function assertNotIncludes(text, forbidden, label) {
  if (text.includes(forbidden)) {
    throw new Error(`${label} contains forbidden content: ${forbidden}`);
  }
}

const service = read("src/services/messageHistoryExportService.ts");
const app = read("src/App.tsx");
const docs = read("docs/message-history-export.md");

for (const expected of [
  "MessageHistoryExportFormat",
  "requestChannelExportPlaceholder",
  "POST /channels/:channelId/export",
  "GET /exports/:exportId/status",
  "permission_required",
  "queued_placeholder",
]) {
  assertIncludes(service, expected, "message history export service");
}

for (const expected of [
  "messageHistoryExportService",
  "Export message history placeholder",
  "requestChannelExportPlaceholder",
]) {
  assertIncludes(app, expected, "channel context menu integration");
}

for (const expected of [
  "Message History Export Placeholder",
  "private channel",
  "manageCommunity",
  "exportMessages",
  "Do not include",
  "Future export status flow",
]) {
  assertIncludes(docs, expected, "message history export docs");
}

for (const forbidden of ["passwordHash", "service_role", "refresh_token", "access_token"]) {
  assertNotIncludes(service, forbidden, "message history export service");
}

console.log("Message history export placeholder smoke test passed.");

