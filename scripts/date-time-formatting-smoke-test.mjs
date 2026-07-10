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
const communityEvents = read("src/components/CommunityEventsAdminSection.tsx");
const communityAudit = read("src/components/CommunityAuditLogSection.tsx");
const companionRail = read("src/components/FeedCompanionRail.tsx");
const insights = read("src/components/CommunityInsightsView.tsx");
const moderation = read("src/components/community/CommunityAdminSections.tsx");
const logsViewer = read("src/components/settings/LogsViewer.tsx");
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
  ["CommunityEventsAdminSection", communityEvents],
  ["CommunityAuditLogSection", communityAudit],
  ["FeedCompanionRail", companionRail],
  ["CommunityInsightsView", insights],
  ["CommunityAdminSections", moderation],
  ["LogsViewer", logsViewer],
]) {
  assertIncludes(text, "dateTimeService", label);
}

assertIncludes(doc, "system timezone", "date/time docs");
assertIncludes(doc, "Current runtime coverage", "date/time docs");
assertIncludes(doc, "Turkish", "date/time docs");

if (service.includes('"Invalid date"') || service.includes('"Invalid time"')) {
  throw new Error("dateTimeService contains a hardcoded English invalid-date fallback.");
}
assertIncludes(service, '"—"', "language-neutral invalid date fallback");

console.log("Date/time/timezone formatting smoke test passed.");
