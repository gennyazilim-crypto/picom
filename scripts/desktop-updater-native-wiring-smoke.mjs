import { readFile } from "node:fs/promises";

const [updater, channels, preload, main, service, builder, pkg] = await Promise.all([
  readFile("electron/updater.cts", "utf8"),
  readFile("electron/ipcChannels.cts", "utf8"),
  readFile("electron/preload.cts", "utf8"),
  readFile("electron/main.cts", "utf8"),
  readFile("src/services/updateService.ts", "utf8"),
  readFile("electron-builder.yml", "utf8"),
  readFile("package.json", "utf8"),
]);

const checks = [
  // Main-process updater owns electron-updater and enforces the chosen policy.
  [updater.includes('from "electron-updater"'), "main updater imports electron-updater"],
  [updater.includes("autoUpdater.autoDownload = true"), "auto-download enabled"],
  [updater.includes("autoUpdater.autoInstallOnAppQuit = false"), "silent install-on-quit disabled"],
  [!updater.includes("autoInstallOnAppQuit = true"), "no silent auto-install path"],
  [updater.includes("PICOM_UPDATE_FEED_URL"), "feed URL is env-driven"],
  [updater.includes('provider: "generic"'), "generic update provider"],
  [updater.includes('url.protocol !== "https:"'), "feed requires HTTPS"],
  [updater.includes("app.isPackaged") && updater.includes("PICOM_UPDATE_ALLOW_DEV"), "disabled by default outside packaged builds"],
  [!updater.includes("verifyUpdateCodeSignature = () =>") && !updater.includes("verifyUpdateCodeSignature=()=>"), "signature verification not bypassed"],

  // Whitelisted IPC surface.
  [channels.includes('updateGetState: "picom:update-get-state"'), "update-get-state channel"],
  [channels.includes('updateCheck: "picom:update-check"'), "update-check channel"],
  [channels.includes('updateDownload: "picom:update-download"'), "update-download channel"],
  [channels.includes('updateInstall: "picom:update-install"'), "update-install channel"],
  [channels.includes('updateStateChanged: "picom:update-state-changed"'), "update-state push channel"],

  // Main process wires init + trusted IPC handlers.
  [main.includes("initUpdater(broadcastUpdaterState)"), "main initializes the updater"],
  [main.includes("IPC_CHANNELS.updateInstall") && main.includes("isTrustedIpcEvent(event)"), "update install handler is sender-trusted"],

  // Preload exposes a narrow, validated bridge (no raw updater objects).
  [preload.includes("updates: {") && preload.includes("onStateChange"), "preload exposes updates bridge"],
  [preload.includes("isUpdaterState(value)"), "preload validates pushed update state"],

  // Renderer bridges to the native updater but stays dependency-free and never auto-installs.
  [service.includes("window.picomDesktop?.updates"), "renderer bridges to native updater"],
  [!service.includes("electron-updater"), "renderer stays electron-updater-free"],
  [service.includes("autoUpdateEnabled: false"), "renderer never advertises silent auto-update"],

  // Committed config stays disabled; the runtime feed is env-driven.
  [builder.includes("publish: null"), "committed build keeps publish disabled"],
  [pkg.includes('"electron-updater"'), "electron-updater pinned as a dependency"],
  [pkg.includes('"update:native:wiring:smoke"'), "native wiring smoke registered"],
];

const failed = checks.filter(([ok]) => !ok);
if (failed.length) {
  for (const [, label] of failed) console.error(`FAIL: ${label}`);
  process.exit(1);
}
for (const [, label] of checks) console.log(`PASS: ${label}`);
console.log("Desktop native updater wiring smoke test passed.");
