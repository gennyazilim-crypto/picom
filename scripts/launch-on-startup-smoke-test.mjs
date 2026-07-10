import { readFileSync } from "node:fs";

const files = {
  service: "src/services/startupService.ts",
  settings: "src/components/SettingsModal.tsx",
  main: "electron/main.cts",
  preload: "electron/preload.cts",
  types: "src/types/picomDesktop.d.ts",
  docs: "docs/desktop/launch-at-startup-production.md",
  checkpoint: "docs/task-checkpoints/task-136-launch-at-startup-production.md",
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
const main = read(files.main);
const preload = read(files.preload);
const types = read(files.types);
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
  "refreshNativeState()",
  "window.picomDesktop?.startup",
  "localStorage.setItem(startupSettingsKey",
].forEach((needle) => assertIncludes(service, needle, `startup service ${needle}`));

[
  "import { startupService } from \"../services/startupService\";",
  "const [startupSettings, setStartupSettings]",
  "updateLaunchOnStartup",
  "updateStartMinimizedToTray",
  "Launch Picom on startup",
  "Start minimized to tray placeholder",
].forEach((needle) => assertIncludes(settings, needle, `settings startup UI ${needle}`));

[
  "Launch at Startup Production",
  "disabled by default",
  "Linux",
  "No React component imports Electron",
].forEach((needle) => assertIncludes(docs, needle, `startup docs ${needle}`));

assertIncludes(checkpoint, "Task 136 - Launch at Startup Production", "checkpoint title");

["app.setLoginItemSettings", "app.getLoginItemSettings", "IPC_CHANNELS.startupGetState", "IPC_CHANNELS.startupSetEnabled"].forEach((needle) => assertIncludes(main, needle, `main startup integration ${needle}`));
["startup: {", "getState: ()", "setEnabled: (enabled: boolean)"].forEach((needle) => assertIncludes(preload, needle, `preload startup bridge ${needle}`));
assertIncludes(types, "startup?: {", "startup global type");

const forbiddenRuntimePatterns = [
  "from \"electron\"",
  "from 'electron'",
  "require(\"electron\")",
  "require('electron')",
  "HKEY_CURRENT_USER",
  "LaunchAgents",
  "autostart",
];

[service, settings].forEach((text) => {
  forbiddenRuntimePatterns.forEach((pattern) => assertNotIncludes(text, pattern, "direct startup OS registration in renderer/service"));
});

console.log("Launch on startup production smoke test passed.");
