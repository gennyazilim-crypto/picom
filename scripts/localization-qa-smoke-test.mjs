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

console.log("Localization QA TR/EN smoke test passed.");
