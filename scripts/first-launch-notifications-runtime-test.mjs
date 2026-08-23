import assert from "node:assert/strict";
import { createServer } from "vite";

class MemoryStorage {
  #values = new Map();
  getItem(key) { return this.#values.get(key) ?? null; }
  setItem(key, value) { this.#values.set(key, String(value)); }
  removeItem(key) { this.#values.delete(key); }
}

const storage = new MemoryStorage();
let nativeCapabilityCalls = 0;
let nativeTestCalls = 0;
let nativeTestArgs = [];
const nativeBridge = async () => ({ ok: true, native: true });

globalThis.window = {
  localStorage: storage,
  picomDesktop: {
    getRuntimeInfo: () => ({ runtime: "electron", platform: "win32", versions: {} }),
    showNotification: nativeBridge,
    notifications: {
      getCapability: async () => { nativeCapabilityCalls += 1; return { ok: true, native: true, supported: true }; },
      sendTest: async (...args) => { nativeTestCalls += 1; nativeTestArgs = args; return { ok: true, native: true }; },
    },
  },
};

const vite = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false }, appType: "custom" });
const { notificationService, decideNotificationRoute, isQuietHoursActive } = await vite.ssrLoadModule("/src/services/notificationService.ts");
const { settingsService } = await vite.ssrLoadModule("/src/services/settingsService.ts");
const { notificationPolicyStateService } = await vite.ssrLoadModule("/src/services/notificationPolicyStateService.ts");

// Capability checks are read-only and do not send a native test notification.
const initial = await notificationService.refreshStatus();
assert.equal(initial.capability, "native-available");
assert.equal(initial.permission, "system-controlled");
assert.equal(nativeTestCalls, 0);
assert.equal(nativeCapabilityCalls, 1);

// Native test path is explicitly triggered, fixed-content in main, and payload-free.
const nativeTest = await notificationService.showTestNotification({ title: "Ignored by native main", body: "Ignored by native main" });
assert.equal(nativeTest.ok, true);
assert.equal(nativeTest.permission, "system-controlled");
assert.equal(nativeTestCalls, 1);
assert.deepEqual(nativeTestArgs, []);

// Older Electron bridges without the narrow capability/test endpoints fail closed rather than pretending permission was granted.
globalThis.window = { localStorage: storage, picomDesktop: { getRuntimeInfo: () => ({ runtime: "electron", platform: "win32", versions: {} }), showNotification: nativeBridge } };
const incompleteNativeBridge = await notificationService.refreshStatus();
assert.equal(incompleteNativeBridge.capability, "native-unsupported");
assert.equal((await notificationService.showTestNotification({ title: "PICOM", body: "No bridge" })).ok, false);

const baseline = settingsService.getSettings().notificationSettings;
const enabledSettings = { ...baseline, enabled: true, nativeDesktopEnabled: true, directMessages: false, mentions: true, incomingCalls: false };
assert.equal(decideNotificationRoute({ category: "direct_message", settings: enabledSettings }).desktop, false);
assert.equal(decideNotificationRoute({ category: "mention", isMention: true, settings: enabledSettings }).desktop, true);
assert.equal(decideNotificationRoute({ category: "incoming_call", settings: enabledSettings }).desktop, false);

const overnight = { ...enabledSettings, quietHours: { ...enabledSettings.quietHours, enabled: true, startTime: "22:00", endTime: "07:00", applyTo: "all_notifications" } };
assert.equal(isQuietHoursActive(overnight.quietHours, new Date("2026-08-16T23:30:00")), true);
assert.equal(isQuietHoursActive(overnight.quietHours, new Date("2026-08-16T06:30:00")), true);
assert.equal(isQuietHoursActive(overnight.quietHours, new Date("2026-08-16T12:30:00")), false);
notificationPolicyStateService.setDoNotDisturb(true);
assert.equal(decideNotificationRoute({ category: "mention", settings: enabledSettings }).desktop, false);
notificationPolicyStateService.setDoNotDisturb(false);

// Browser fallback never prompts during normal notification delivery; only explicit test/action requests it.
let requestCalls = 0;
const browserNotifications = [];
class BrowserNotification {
  static permission = "default";
  static async requestPermission() { requestCalls += 1; BrowserNotification.permission = "granted"; return "granted"; }
  constructor(title, options) { browserNotifications.push({ title, options }); }
}
globalThis.window = { localStorage: storage, Notification: BrowserNotification };
const normalBeforePermission = await notificationService.showNotification({ title: "A DM", body: "Body", category: "mention", routing: { settings: enabledSettings } });
assert.equal(normalBeforePermission.ok, false);
assert.equal(normalBeforePermission.permission, "default");
assert.equal(requestCalls, 0);

const browserTest = await notificationService.showTestNotification({ title: "PICOM test notification", body: "Localized test body" });
assert.equal(browserTest.ok, true);
assert.equal(requestCalls, 1);
assert.deepEqual(browserNotifications.at(-1), { title: "PICOM test notification", options: { body: "Localized test body", tag: "picom-test-notification", silent: !baseline.soundEnabled } });

BrowserNotification.permission = "denied";
const denied = await notificationService.showTestNotification({ title: "PICOM", body: "Blocked" });
assert.equal(denied.ok, false);
assert.equal(denied.permission, "denied");

// The first-run UI reads settings but neither mount nor skip writes notification preferences.
assert.equal(storage.getItem("picom-settings") !== null, false);

console.log("First-launch notifications runtime tests passed.");
await vite.close();
