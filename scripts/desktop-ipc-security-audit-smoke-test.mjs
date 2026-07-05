import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mainSource = readFileSync(resolve(root, "electron/main.cts"), "utf8");
const preloadSource = readFileSync(resolve(root, "electron/preload.cts"), "utf8");
const channelsSource = readFileSync(resolve(root, "electron/ipcChannels.cts"), "utf8");
const auditDoc = readFileSync(resolve(root, "docs/desktop-ipc-security-audit.md"), "utf8");

const requiredMainSnippets = [
  "contextIsolation: true",
  "nodeIntegration: false",
  "sandbox: true",
  "webSecurity: true",
  "allowRunningInsecureContent: false",
  "Menu.setApplicationMenu(null)",
  "setWindowOpenHandler",
  "will-navigate",
  "will-attach-webview",
  "normalizeExternalUrl",
  "isSafeDeepLink",
  "BrowserWindow.fromWebContents(event.sender)",
];

const requiredPreloadSnippets = [
  "contextBridge.exposeInMainWorld",
  "Object.freeze(bridge)",
  "invokeWhitelisted",
  "isIpcChannel",
  "ipcRenderer.removeListener",
  "isSafeDeepLink",
  "isTrayActionPayload",
];

const requiredChannelNames = [
  "picom:window-control",
  "picom:screen-capture-get-sources",
  "picom:notification-show",
  "picom:file-pick-images",
  "picom:file-save-text",
  "picom:clipboard-read-text",
  "picom:clipboard-write-text",
  "picom:external-open-url",
  "picom:deep-link-open",
  "picom:power-resume",
];

const requiredDocPhrases = [
  "contextIsolation: true",
  "nodeIntegration: false",
  "sandbox: true",
  "External URLs must be normalized",
  "Screen capture must always be user-mediated",
  "Do not expose raw Electron objects",
];

function requireSnippets(label, source, snippets) {
  const missing = snippets.filter((snippet) => !source.includes(snippet));
  if (missing.length > 0) {
    throw new Error(`${label} missing required IPC security coverage: ${missing.join(", ")}`);
  }
}

requireSnippets("electron/main.cts", mainSource, requiredMainSnippets);
requireSnippets("electron/preload.cts", preloadSource, requiredPreloadSnippets);
requireSnippets("electron/ipcChannels.cts", channelsSource, requiredChannelNames);
requireSnippets("docs/desktop-ipc-security-audit.md", auditDoc, requiredDocPhrases);

if (/from\s+["']electron["']/.test(readFileSync(resolve(root, "src/services/platformService.ts"), "utf8"))) {
  throw new Error("Renderer service imports Electron directly; use preload bridge instead.");
}

console.log("Desktop IPC security audit smoke test passed.");
