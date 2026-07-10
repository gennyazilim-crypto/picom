import fs from "node:fs";

const preload = fs.readFileSync("electron/preload.cts", "utf8");
const channels = fs.readFileSync("electron/ipcChannels.cts", "utf8");
const main = fs.readFileSync("electron/main.cts", "utf8");
const types = fs.readFileSync("src/types/picomDesktop.d.ts", "utf8");
const docs = fs.readFileSync("docs/electron-preload-api.md", "utf8");

if (!preload.includes("contractVersion: 1 as const") || !types.includes("contractVersion: 1")) throw new Error("Preload contract version 1 is not frozen in runtime/types");

const topLevelApis = ["getRuntimeInfo", "windowControl", "isWindowMaximized", "onWindowMaximizeStateChanged", "screenCapture", "showNotification", "tray", "startup", "file", "clipboard", "externalLinks", "deepLinks", "power"];
for (const api of topLevelApis) if (!preload.includes(`${api}:`)) throw new Error(`Preload API missing: ${api}`);
const nestedApis = ["getSources", "setStatus", "setMuted", "setCloseToTray", "showWindow", "quit", "onAction", "getState", "setEnabled", "pickImages", "saveText", "readText", "writeText", "openUrl", "onOpen", "onResume"];
for (const api of nestedApis) if (!preload.includes(`${api}:`)) throw new Error(`Nested preload API missing: ${api}`);

const bridgeSource = preload.slice(preload.indexOf("const bridge"), preload.indexOf("contextBridge.exposeInMainWorld"));
for (const forbidden of ["ipcRenderer:", "desktopCapturer:", "shell:", "electron:", "process:", "require:", "fs:"]) {
  if (bridgeSource.includes(forbidden)) throw new Error(`Raw native object exposed by preload: ${forbidden}`);
}
if ((preload.match(/ipcRenderer\.invoke\(/g) ?? []).length !== 1 || !preload.includes("ipcRenderer.invoke(channel")) throw new Error("Preload must invoke IPC only through invokeWhitelisted");

const channelKeys = [...channels.matchAll(/^\s{2}(\w+): "(picom:[^"]+)"/gm)];
if (channelKeys.length !== 20) throw new Error(`Expected 20 frozen IPC channels, found ${channelKeys.length}`);
for (const [, key, value] of channelKeys) {
  if (!docs.includes(`\`${value}\``)) throw new Error(`IPC channel missing from contract docs: ${value}`);
  if (!preload.includes(`IPC_CHANNELS.${key}`)) throw new Error(`IPC channel is not represented in preload: ${key}`);
}

const handlerCount = (main.match(/ipcMain\.handle\(/g) ?? []).length;
const trustCheckCount = (main.match(/isTrustedIpcEvent\(event\)/g) ?? []).length;
if (handlerCount !== 16 || trustCheckCount !== handlerCount) throw new Error(`Every IPC handler must validate its sender (handlers=${handlerCount}, checks=${trustCheckCount})`);
for (const validator of ["isWindowAction", "parseNotificationPayload", "isTrayStatus", "parseSaveTextPayload", "parseClipboardWritePayload", "normalizeExternalUrl"]) {
  if (!main.includes(validator)) throw new Error(`Main IPC payload validator missing: ${validator}`);
}

console.log("Electron preload API contract test passed.");
