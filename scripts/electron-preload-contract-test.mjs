import fs from "node:fs";

const preload = fs.readFileSync("electron/preload.cts", "utf8");
const channels = fs.readFileSync("electron/ipcChannels.cts", "utf8");
const main = fs.readFileSync("electron/main.cts", "utf8");
const types = fs.readFileSync("src/types/picomDesktop.d.ts", "utf8");
const docs = fs.readFileSync("docs/electron-preload-api.md", "utf8");

if (!preload.includes("contractVersion: 1 as const") || !types.includes("contractVersion: 1")) throw new Error("Preload contract version 1 is not frozen in runtime/types");

const topLevelApis = ["getRuntimeInfo", "windowControl", "isWindowMaximized", "onWindowMaximizeStateChanged", "screenCapture", "showNotification", "notifications", "incomingCall", "tray", "startup", "file", "clipboard", "externalLinks", "deepLinks", "power", "updates", "activity"];
for (const api of topLevelApis) if (!preload.includes(`${api}:`)) throw new Error(`Preload API missing: ${api}`);
const nestedApis = ["getSources", "selectSource", "cancelSelection", "setStatus", "setMuted", "setCloseToTray", "showWindow", "quit", "onAction", "getState", "setEnabled", "pickImages", "saveText", "readText", "writeText", "openUrl", "onOpen", "onResume", "check", "download", "install", "onStateChange", "show", "dismiss", "respond", "getSnapshot", "getCapability", "sendTest"];
for (const api of nestedApis) if (!preload.includes(`${api}:`)) throw new Error(`Nested preload API missing: ${api}`);

const bridgeSource = preload.slice(preload.indexOf("const bridge"), preload.indexOf("contextBridge.exposeInMainWorld"));
for (const forbidden of ["ipcRenderer:", "desktopCapturer:", "shell:", "electron:", "process:", "require:", "fs:"]) {
  if (bridgeSource.includes(forbidden)) throw new Error(`Raw native object exposed by preload: ${forbidden}`);
}
if ((preload.match(/ipcRenderer\.invoke\(/g) ?? []).length !== 1 || !preload.includes("ipcRenderer.invoke(channel")) throw new Error("Preload must invoke IPC only through invokeWhitelisted");

const channelKeys = [...channels.matchAll(/^\s{2}(\w+): "(picom:[^"]+)"/gm)];
if (channelKeys.length === 0) throw new Error("IPC channel registry is empty");
if (new Set(channelKeys.map(([, , value]) => value)).size !== channelKeys.length) throw new Error("IPC channel registry contains duplicate values");
for (const [, key, value] of channelKeys) {
  if (!preload.includes(`IPC_CHANNELS.${key}`)) throw new Error(`IPC channel is not represented in preload: ${key}`);
}
for (const value of ["picom:notification-show", "picom:notification-get-capability", "picom:notification-send-test"]) {
  if (!docs.includes(`\`${value}\``)) throw new Error(`Notification IPC channel missing from contract docs: ${value}`);
}

const handlerKeys = [...main.matchAll(/ipcMain\.handle\(IPC_CHANNELS\.(\w+)/g)].map(([, key]) => key);
if (new Set(handlerKeys).size !== handlerKeys.length) throw new Error("An IPC handler channel is registered more than once");
for (const key of ["notificationGetCapability", "notificationSendTest"]) {
  if (!handlerKeys.includes(key)) throw new Error(`Notification IPC handler is missing: ${key}`);
  const start = main.indexOf(`ipcMain.handle(IPC_CHANNELS.${key}`);
  const next = main.indexOf("ipcMain.handle(", start + 1);
  const handler = main.slice(start, next === -1 ? undefined : next);
  if (!handler.includes("isTrustedMainWindowIpcEvent(event)")) throw new Error(`Notification IPC handler must validate its sender: ${key}`);
  if (key === "notificationSendTest" && /\(event\s*,/.test(handler)) throw new Error("Test notification IPC must not accept renderer payloads");
}
if (!/sendTest:\s*\(\)\s*=>/.test(preload)) throw new Error("Preload test notification API must be payload-free");

for (const validator of ["isWindowAction", "parseNotificationPayload", "parseIncomingCallToastPayload", "parseIncomingCallToastAction", "isTrayStatus", "parseSaveTextPayload", "parseClipboardWritePayload", "normalizeExternalUrl", "parseScreenCaptureListPayload", "parseScreenCaptureSelectionPayload", "parseScreenCaptureCancelPayload"]) {
  if (!main.includes(validator)) throw new Error(`Main IPC payload validator missing: ${validator}`);
}

console.log("Electron preload API contract test passed.");
