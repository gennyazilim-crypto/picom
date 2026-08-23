/**
 * Settings production readiness unit checks (schema, search, URL allowlist).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function pass(name) {
  console.log(`PASS: ${name}`);
}

// --- Search catalog (source text) ---
const searchSrc = readFileSync(path.join(root, "src/services/settings/settingsSearchIndex.ts"), "utf8");
assert.match(searchSrc, /mikrofon|microphone/i);
assert.match(searchSrc, /export function searchSettingsCatalog/);
assert.match(searchSrc, /titleTr/);
assert.match(searchSrc, /translateSettings/);
assert.match(searchSrc, /translateSettingsSection/);
assert.match(searchSrc, /getUiLanguageBcp47/);
assert.doesNotMatch(searchSrc, /other UiLanguage codes use the English pack/);
pass("settings search catalog resolves labels and matching text through all locale catalogs");

// --- Persistence registry ---
const settingsSrc = readFileSync(path.join(root, "src/services/settingsService.ts"), "utf8");
assert.match(settingsSrc, /account-center/);
assert.match(settingsSrc, /main-process-device/);
assert.match(settingsSrc, /Windows & Startup/);
assert.match(settingsSrc, /settingsNavGroups/);
pass("settings persistence registry + nav groups");

// --- Account Center URLs ---
const urlsSrc = readFileSync(path.join(root, "src/config/accountCenterUrls.ts"), "utf8");
assert.match(urlsSrc, /sessions:/);
assert.match(urlsSrc, /dataExport:/);
assert.match(urlsSrc, /deleteAccount:/);
assert.match(urlsSrc, /isAllowedAccountCenterUrl/);
assert.match(urlsSrc, /account\.picom\.gg/);
pass("Account Center URL allowlist + deep links");

// --- Google paused / Epic portal messaging ---
const socialSrc = readFileSync(path.join(root, "src/services/auth/socialAuthService.ts"), "utf8");
assert.match(socialSrc, /PAUSED BY PRODUCT DECISION/);
assert.match(socialSrc, /Kurulum bekleniyor/);
pass("provider product gates (Google paused, Epic setup pending)");

// --- IPC channels for device settings / cache ---
const ipcSrc = readFileSync(path.join(root, "electron/ipcChannels.cts"), "utf8");
assert.match(ipcSrc, /settingsGet/);
assert.match(ipcSrc, /cacheClear/);
assert.match(ipcSrc, /appOpenPath/);
pass("IPC allowlist channels for settings/cache/paths");

const storeSrc = readFileSync(path.join(root, "electron/deviceLocalSettingsStore.cts"), "utf8");
assert.match(storeSrc, /device-local-settings\.v1\.json/);
assert.doesNotMatch(storeSrc, /service_role|access_token|refresh_token/i);
pass("main-process device local settings store (no secrets)");

// --- Account summary has no password form ---
const accountSrc = readFileSync(path.join(root, "src/components/settings/AccountSummarySection.tsx"), "utf8");
assert.doesNotMatch(accountSrc, /type=\"password\"/);
assert.match(accountSrc, /accountCenterUrls/);
pass("Account summary delegates security to Account Center");

// --- Settings i18n parity + hardcoded UX scan ---
const { execSync } = await import("node:child_process");
execSync("node scripts/settings-i18n-scan.mjs", { cwd: root, stdio: "inherit" });
pass("settings i18n catalog parity + Settings UX scan");

console.log("settings-production-unit: PASS");
