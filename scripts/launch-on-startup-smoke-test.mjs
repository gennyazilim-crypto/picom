import { readFileSync } from "node:fs";

const files = {
  service: "src/services/startupService.ts",
  settings: "src/components/SettingsModal.tsx",
  docs: "docs/launch-on-startup.md",
  checkpoint: "docs/task-checkpoints/task-372-launch-on-startup-placeholder.md",
};

function read(path) {
  return readFileSync(path, "utf8");
}

function assertIncludes(text, needle, label) {
  if (!text.includes(needle)) {
    throw new Error(`Missing ${label}: ${needle}`);
  }
}

function assertNotIncludes(text, needle, label) {
  if (text.includes(needle)) {
    throw new Error(`Unexpected ${label}: ${needle}`);
  }
}

const service = read(files.service);
const settings = read(files.settings);
const docs = read(files.docs);
const checkpoint = read(files.checkpoint);

[
  "export interface StartupSettings",
  "launchOnStartup: boolean",
  "startMinimizedToTray: boolean",
  "isLaunchOnStartupEnabled()",
  "setLaunchOnStartupEnabled(enabled: boolean)",
  "toggleLaunchOnStartup()",
  "setStartMinimizedToTray(enabled: boolean)",
  "localStorage.setItem(startupSettingsKey",
].forEach((needle) => assertIncludes(service, needle, `startup service ${needle}`));

[
  "import { startupService } from \"../services/startupService\";",
  "const [startupSettings, setStartupSettings]",
  "updateLaunchOnStartup",
  "updateStartMinimizedToTray",
  "Launch Picom on startup placeholder",
  "Start minimized to tray placeholder",
].forEach((needle) => assertIncludes(settings, needle, `settings startup UI ${needle}`));

[
  "Launch on Startup Placeholder",
  "app.setLoginItemSettings()",
  "No login item, registry key, launch agent, or autostart desktop entry is written",
  "The renderer does not call Electron APIs directly.",
].forEach((needle) => assertIncludes(docs, needle, `startup docs ${needle}`));

assertIncludes(checkpoint, "Task 372 - Launch on startup placeholder", "checkpoint title");

const forbiddenRuntimePatterns = [
  "from \"electron\"",
  "from 'electron'",
  "require(\"electron\")",
  "require('electron')",
  "setLoginItemSettings",
  "HKEY_CURRENT_USER",
  "LaunchAgents",
  "autostart",
];

[service, settings].forEach((text) => {
  forbiddenRuntimePatterns.forEach((pattern) => assertNotIncludes(text, pattern, "direct startup OS registration in renderer/service"));
});

console.log("Launch on startup placeholder smoke test passed.");
