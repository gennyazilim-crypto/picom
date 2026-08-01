/**
 * Notification ownership + settings i18n parity unit tests.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Load TS modules via experimental strip-types if available; else dynamic import after transpile-free path.
async function loadOwnership() {
  try {
    return await import(pathToFileURL(path.join(root, "src/services/settings/notificationOwnership.ts")).href);
  } catch {
    // Fallback: re-implement critical assertions against source text.
    return null;
  }
}

const ownership = await loadOwnership();
if (!ownership) {
  console.error("FAIL: could not import notificationOwnership.ts");
  process.exit(1);
}

const {
  ownershipOfNotificationKey,
  rejectUnknownNotificationKeys,
  splitNotificationOwnership,
  mergeRemoteNotificationSettings,
  toSyncedNotificationPayload,
  composeNotificationSettings,
  resolveNotificationToggleEnabled,
  migrateLegacyQuietHoursApplyTo,
  defaultNotificationDeviceSettings,
  defaultNotificationSyncedSettings,
} = ownership;

assert.equal(ownershipOfNotificationKey("nativeDesktopEnabled"), "device");
assert.equal(ownershipOfNotificationKey("soundEnabled"), "device");
assert.equal(ownershipOfNotificationKey("quietHours"), "device");
assert.equal(ownershipOfNotificationKey("directMessages"), "synced");
assert.equal(ownershipOfNotificationKey("securityAlerts"), "synced");
assert.equal(ownershipOfNotificationKey("legacy_unknown_key"), "unknown");
console.log("PASS: local versus synced ownership");

const rejected = rejectUnknownNotificationKeys({ directMessages: false, fooBar: true });
assert.equal(rejected.ok, false);
assert.deepEqual(rejected.unknownKeys, ["fooBar"]);
const accepted = rejectUnknownNotificationKeys({ mentions: true, soundEnabled: false });
assert.equal(accepted.ok, true);
console.log("PASS: unknown key rejection");

assert.equal(migrateLegacyQuietHoursApplyTo("sounds_only_placeholder"), "sounds_only");
const migrated = splitNotificationOwnership({
  nativeDesktopEnabled: false,
  soundEnabled: true,
  directMessages: false,
  quietHours: { enabled: true, startTime: "21:00", endTime: "06:00", applyTo: "sounds_only_placeholder", allowMentions: true },
});
assert.equal(migrated.device.nativeDesktopEnabled, false);
assert.equal(migrated.device.quietHours.applyTo, "sounds_only");
assert.equal(migrated.synced.directMessages, false);
assert.equal(migrated.synced.securityAlerts, true);
console.log("PASS: legacy key migration");

const device = defaultNotificationDeviceSettings();
const synced = defaultNotificationSyncedSettings();
const composed = composeNotificationSettings({ ...device, soundEnabled: false }, { ...synced, mentions: false });
assert.equal(composed.soundEnabled, false);
assert.equal(composed.mentions, false);
const payload = toSyncedNotificationPayload(composed);
assert.equal("soundEnabled" in payload, false);
assert.equal("nativeDesktopEnabled" in payload, false);
assert.equal("quietHours" in payload, false);
assert.equal(payload.mentions, false);
assert.equal(payload.securityAlerts, true);
console.log("PASS: default value resolution + synced payload strips device keys");

const current = composeNotificationSettings(
  { ...device, nativeDesktopEnabled: false, soundEnabled: false },
  { ...synced, directMessages: true },
);
const merged = mergeRemoteNotificationSettings(current, {
  nativeDesktopEnabled: true,
  soundEnabled: true,
  directMessages: false,
});
assert.equal(merged.nativeDesktopEnabled, false, "remote must not overwrite device native toggle");
assert.equal(merged.soundEnabled, false, "remote must not overwrite device sound");
assert.equal(merged.directMessages, false, "remote synced category applies");
console.log("PASS: hydrate merge preserves device keys (rollback-safe ownership)");

assert.equal(resolveNotificationToggleEnabled(composed, "denied", "nativeDesktopEnabled"), false);
assert.equal(resolveNotificationToggleEnabled({ ...composed, enabled: false }, "granted", "soundEnabled"), false);
assert.equal(resolveNotificationToggleEnabled({ ...composed, nativeDesktopEnabled: true, soundEnabled: true, enabled: true }, "granted", "soundEnabled"), true);
console.log("PASS: permission denied + quiet-hours-related toggle resolution");

// i18n parity
const i18n = await import(pathToFileURL(path.join(root, "src/services/settings/settingsI18n.ts")).href);
const parity = i18n.assertSettingsI18nParity();
assert.equal(parity.ok, true, JSON.stringify(parity));
assert.match(i18n.translateSettings("nav.searchEmpty", "en", { query: "mic" }), /mic/);
assert.match(i18n.translateSettings("nav.searchEmpty", "tr", { query: "mikrofon" }), /mikrofon/);
assert.doesNotMatch(i18n.translateSettings("account.logout", "tr"), /account\.logout/);
console.log("PASS: i18n key parity + interpolation + no raw key");

console.log("settings-notification-ownership-unit: PASS");
