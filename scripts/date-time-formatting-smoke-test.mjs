import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assertIncludes(text, expected, label) {
  if (!text.includes(expected)) {
    throw new Error(`${label} missing expected content: ${expected}`);
  }
}

const service = read("src/services/dateTimeService.ts");
const messageItem = read("src/components/MessageItem.tsx");
const mentionFeedCard = read("src/components/MentionFeedCard.tsx");
const directMessages = read("src/components/DirectMessagesView.tsx");
const profileView = read("src/components/ProfileView.tsx");
const settingsModal = read("src/components/SettingsModal.tsx");
const doc = read("docs/date-time-timezone-formatting.md");

for (const expected of [
  "Intl.DateTimeFormat",
  "Intl.RelativeTimeFormat",
  "formatMessageTime",
  "formatCompactDateTime",
  "formatFullTimestamp",
  "formatRelativeTime",
  "formatAuditTimestamp",
  "formatNotificationTimestamp",
  "formatEventRange",
  "navigator.language",
]) {
  assertIncludes(service, expected, "dateTimeService");
}

for (const [label, text] of [
  ["MessageItem", messageItem],
  ["MentionFeedCard", mentionFeedCard],
  ["DirectMessagesView", directMessages],
  ["ProfileView", profileView],
  ["SettingsModal", settingsModal],
]) {
  assertIncludes(text, "dateTimeService", label);
}

assertIncludes(doc, "system timezone", "date/time docs");
assertIncludes(doc, "Current runtime coverage", "date/time docs");
assertIncludes(doc, "Turkish", "date/time docs");

console.log("Date/time/timezone formatting smoke test passed.");
