import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { ALLOWED_INTERFACE_SCALES, isAllowedInterfaceScale, normalizeInterfaceScale } = require("../electron/uiScalePolicy.cjs");
const main = readFileSync("electron/main.cts", "utf8");
const preload = readFileSync("electron/preload.cts", "utf8");
const channels = readFileSync("electron/ipcChannels.cts", "utf8");
const electronBuild = readFileSync("scripts/build-electron.mjs", "utf8");

assert.deepEqual(ALLOWED_INTERFACE_SCALES, [0.9, 1, 1.1, 1.25]);
for (const scale of ALLOWED_INTERFACE_SCALES) assert.equal(isAllowedInterfaceScale(scale), true, `${scale} must be accepted`);
for (const invalid of [0, -1, Number.NaN, 5, 1.2, "1.1", null]) assert.equal(isAllowedInterfaceScale(invalid), false, `${String(invalid)} must be rejected`);
assert.equal(normalizeInterfaceScale(1.1), 1.1);
assert.equal(normalizeInterfaceScale(5), 1);

assert.match(channels, /appearanceSetInterfaceScale/);
assert.match(preload, /isAllowedInterfaceScale\(scale\)/);
assert.match(preload, /invokeWhitelisted\(IPC_CHANNELS\.appearanceSetInterfaceScale, scale\)/);
assert.doesNotMatch(preload, /webContents\s*:/, "renderer must not receive a generic webContents bridge");
assert.match(main, /ipcMain\.handle\(IPC_CHANNELS\.appearanceSetInterfaceScale/);
assert.match(main, /isTrustedIpcEvent\(event\)/, "main handler must reject untrusted senders");
assert.match(main, /BrowserWindow\.fromWebContents\(event\.sender\)/);
assert.match(main, /window\.webContents\.id !== event\.sender\.id/);
assert.match(main, /window\.webContents\.setZoomFactor\(scale\)/);
assert.match(electronBuild, /copyFile\(uiScalePolicySource, uiScalePolicyOutput\)/, "the main-process policy must be included in dist-electron");

console.log("Electron UI-scale policy, whitelist, and trusted-sender IPC checks passed.");
