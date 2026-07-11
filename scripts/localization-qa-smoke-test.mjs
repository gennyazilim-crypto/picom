import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assertIncludes(text, expected, label) {
  if (!text.includes(expected)) {
    throw new Error(`${label} missing expected content: ${expected}`);
  }
}

const doc = read("docs/localization-qa-tr-en.md");
const tabs = read("src/components/MentionFeedTabs.tsx");
const styles = read("src/styles.css") + read("src/components/MentionFeedMain.css");
const dateTimeService = read("src/services/dateTimeService.ts");

for (const expected of [
  "English",
  "Turkish",
  "Windows",
  "Linux",
  "macOS",
  "Electron custom titlebar",
  "ServerRail",
  "CommunitySidebar",
  "ChatHeader",
  "MessageList",
  "MessageComposer",
  "MemberSidebar",
  "SettingsModal",
  "DesktopContextMenu",
  "UserProfilePopover",
  "ImagePreviewModal",
  "Takip Ettiğin Kişiler",
  "no Discord branding",
  "no mobile navigation",
]) {
  assertIncludes(doc, expected, "localization QA doc");
}

for (const expected of ["mention-tab-label", "mention-tab-count", "Takip Ettiğin Kişiler"]) {
  assertIncludes(tabs, expected, "localized Mention Feed tabs");
}

for (const expected of [".mention-tab-label", "text-overflow:ellipsis", "white-space:nowrap"]) {
  assertIncludes(styles, expected, "Turkish label overflow CSS");
}

for (const expected of ["navigator.languages?.[0]", "resolvedOptions().locale", "Intl.DateTimeFormat", "Intl.RelativeTimeFormat"]) {
  assertIncludes(dateTimeService, expected, "locale-aware dateTimeService");
}

for (const expected of ["typed central runtime message catalog", "Never translate user-generated", "pseudo-locale", "UTF-8"]) {
  assertIncludes(doc, expected, "extended localization policy");
}

console.log("Localization QA TR/EN smoke test passed.");
