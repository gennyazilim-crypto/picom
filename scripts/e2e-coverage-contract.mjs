import { access, readFile } from "node:fs/promises";
import path from "node:path";

const manifest = JSON.parse(await readFile("tests/e2e/e2e-coverage-manifest.json", "utf8"));
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const requiredFlows = Object.freeze({
  startup: ["src/main.tsx"],
  "auth-login-register": ["src/components/LoginScreen.tsx", "src/components/RegisterScreen.tsx"],
  onboarding: ["src/components/onboarding/OnboardingFlow.tsx"],
  "mention-feed": ["src/components/MentionFeedMain.tsx"],
  "full-profile": ["src/components/ProfileView.tsx"],
  "community-channel-switching": ["src/components/CommunitySidebar.tsx", "src/components/ChatMain.tsx"],
  "message-send": ["src/components/MessageComposer.tsx", "src/components/MessageList.tsx"],
  "emoji-reaction-reply": ["src/components/EmojiPicker.tsx", "src/components/MessageItem.tsx"],
  "attachment-upload": ["src/components/AttachmentGrid.tsx", "src/components/MessageComposer.tsx"],
  "role-aware-community-menu": ["src/components/CommunityMenu.tsx"],
  "visitor-read-only": ["src/components/CommunitySidebar.tsx", "src/components/MessageComposer.tsx"],
  "direct-messages": ["src/components/DirectMessagesView.tsx"],
  "voice-room": ["src/components/VoiceRoomView.tsx"],
  "screen-share": ["src/components/voice/ScreenSharePreview.tsx"],
  "settings-diagnostics": ["src/components/SettingsModal.tsx"],
});
const failures = [];

if (manifest.schemaVersion !== 1) failures.push("schemaVersion must be 1");
if (manifest.runnerStatus !== "planned") failures.push("runnerStatus cannot claim implementation before a real UI E2E runner exists");
if (manifest.productionAllowed !== false) failures.push("production E2E targeting must remain disabled");
if (JSON.stringify(manifest.allowedModes) !== JSON.stringify(["mock", "staging"])) failures.push("only separated mock/staging modes are allowed");
if (!Array.isArray(manifest.flows)) failures.push("flows must be an array");

const flows = Array.isArray(manifest.flows) ? manifest.flows : [];
for (const id of Object.keys(requiredFlows)) if (!flows.some((flow) => flow.id === id)) failures.push(`missing core E2E flow: ${id}`);
for (const flow of flows) {
  const expectedEntries = requiredFlows[flow.id];
  if (!expectedEntries) failures.push(`unexpected flow: ${flow.id}`);
  if (flow.mockUi !== "planned" || flow.stagingUi !== "planned") failures.push(`${flow.id} cannot claim UI automation before runner activation`);
  if (!Array.isArray(flow.preflightCommands) || !flow.preflightCommands.length) failures.push(`${flow.id} needs preflight commands`);
  for (const command of flow.preflightCommands ?? []) if (typeof packageJson.scripts?.[command] !== "string") failures.push(`${flow.id} references missing npm command: ${command}`);
  if (JSON.stringify(flow.entryFiles) !== JSON.stringify(expectedEntries)) failures.push(`${flow.id} entryFiles must match the current release architecture`);
  for (const file of flow.entryFiles ?? []) {
    if (typeof file !== "string" || path.isAbsolute(file) || file.includes("\\")) failures.push(`${flow.id} entryFile must be a portable repository-relative path: ${file}`);
    else {
      try { await access(file); } catch { failures.push(`${flow.id} entryFile does not exist: ${file}`); }
    }
  }
}
if (JSON.stringify(manifest.desktopPlatforms) !== JSON.stringify(["windows", "linux", "macos"])) failures.push("desktop platform coverage must include Windows, Linux and macOS");

if (failures.length) { for (const failure of failures) console.error(`FAIL: ${failure}`); process.exit(1); }
console.log(`PASS: E2E coverage contract maps ${flows.length} core flows to existing preflight checks and separate mock/staging plans.`);
console.log("INFO: no UI E2E execution is claimed; Playwright/Electron runner activation remains pending.");
