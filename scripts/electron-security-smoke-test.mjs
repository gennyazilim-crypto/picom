import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mainSource = readFileSync(resolve(root, "electron/main.cts"), "utf8");
const preloadSource = readFileSync(resolve(root, "electron/preload.cts"), "utf8");

const mainRequiredSnippets = [
  "contextIsolation: true",
  "nodeIntegration: false",
  "sandbox: true",
  "webSecurity: true",
  "allowRunningInsecureContent: false",
  "autoHideMenuBar: true",
  "Menu.setApplicationMenu(null)",
  "setMenuBarVisibility(false)",
  "will-attach-webview",
  "setWindowOpenHandler"
];

for (const snippet of mainRequiredSnippets) {
  if (!mainSource.includes(snippet)) {
    throw new Error(`Missing Electron main security setting: ${snippet}`);
  }
}

const preloadRequiredSnippets = [
  "contextBridge.exposeInMainWorld",
  "Object.freeze(bridge)",
  "invokeWhitelisted",
  "isIpcChannel",
  "removeListener"
];

for (const snippet of preloadRequiredSnippets) {
  if (!preloadSource.includes(snippet)) {
    throw new Error(`Missing Electron preload safety setting: ${snippet}`);
  }
}

console.log("✓ Electron main security settings");
console.log("✓ preload bridge safety settings");
console.log("✓ Electron security smoke test completed");
