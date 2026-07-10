import { readFileSync } from "node:fs";

const files = {
  main: "electron/main.cts",
  preload: "electron/preload.cts",
  trayService: "src/services/trayService.ts",
  app: "src/App.tsx",
  types: "src/types/picomDesktop.d.ts",
  docs: "docs/electron-native-services.md",
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

const main = read(files.main);
const preload = read(files.preload);
const trayService = read(files.trayService);
const app = read(files.app);
const types = read(files.types);
const docs = read(files.docs);

[
  "Tray,",
  "function createTrayMenu()",
  "Open Picom",
  "Set Status",
  "Mute Notifications",
  "new Tray(",
  "createTray();",
  "IPC_CHANNELS.traySetStatus",
  "IPC_CHANNELS.traySetMuted",
  "IPC_CHANNELS.traySetCloseToTray",
  'mainWindow.on("close"',
  "closeToTrayEnabled && tray",
  'app.on("before-quit"',
  "IPC_CHANNELS.trayAction",
].forEach((needle) => assertIncludes(main, needle, `main tray integration ${needle}`));

[
  "tray: {",
  "setStatus: (status: TrayStatus)",
  "setMuted: (muted: boolean)",
  "setCloseToTray: (enabled: boolean)",
  "showWindow: ()",
  "quit: ()",
  "onAction: (callback: (payload: TrayActionPayload) => void)",
  "isTrayActionPayload(value)",
].forEach((needle) => assertIncludes(preload, needle, `preload tray bridge ${needle}`));

[
  "window.picomDesktop?.tray",
  "setStatus(status: TrayStatus)",
  "setMuted(muted: boolean)",
  "setCloseToTrayEnabled(enabled: boolean)",
  "syncCloseToTrayPreference()",
  "showWindow()",
  "quit()",
  "onAction(callback",
].forEach((needle) => assertIncludes(trayService, needle, `renderer tray service ${needle}`));

[
  "import { trayService, type TrayStatus } from \"./services/trayService\";",
  "const [trayPresenceStatus, setTrayPresenceStatus]",
  "trayService.onAction(handleTrayAction)",
  "settingsService.updateNotificationSettings({ muted: payload.muted })",
  "setTrayPresenceStatus(payload.action)",
  "mapTrayStatusToMemberStatus(trayPresenceStatus)",
].forEach((needle) => assertIncludes(app, needle, `App tray action handling ${needle}`));

[
  "type PicomTrayStatus",
  "type PicomTrayActionPayload",
  "tray?: {",
  "onAction: (callback: (payload: PicomTrayActionPayload) => void) => () => void;",
].forEach((needle) => assertIncludes(types, needle, `tray global type ${needle}`));

[
  "## Tray bridge",
  "React components should call `trayService`, not Electron APIs.",
  "Confirm the Picom tray icon appears",
].forEach((needle) => assertIncludes(docs, needle, `tray docs ${needle}`));

const forbiddenRendererPatterns = [
  "from \"electron\"",
  "from 'electron'",
  "require(\"electron\")",
  "require('electron')",
  "new Tray(",
];

[app, trayService].forEach((text) => {
  forbiddenRendererPatterns.forEach((pattern) => assertNotIncludes(text, pattern, "direct Electron renderer usage"));
});

console.log("Real system tray integration smoke test passed.");
