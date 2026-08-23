import assert from "node:assert/strict";
import { createServer } from "vite";

class MemoryStorage {
  #values = new Map();
  getItem(key) { return this.#values.get(key) ?? null; }
  setItem(key, value) { this.#values.set(key, String(value)); }
}

globalThis.window = { localStorage: new MemoryStorage(), picomDesktop: undefined };

const vite = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false }, appType: "custom" });
try {
  const { settingsService } = await vite.ssrLoadModule("/src/services/settingsService.ts");
  const { isQuietHoursActive, quietHoursSuppressesDesktop, quietHoursShouldSilence } = await vite.ssrLoadModule("/src/services/notificationService.ts");
  const settings = settingsService.getSettings().notificationSettings;
  const quietHours = { ...settings.quietHours, enabled: true, startTime: "22:00", endTime: "07:00", applyTo: "all_notifications", allowMentions: false };
  const configured = { ...settings, quietHours };

  assert.match(settings.quietHours.startTime, /^([01]\d|2[0-3]):[0-5]\d$/, "default start time is normalized");
  assert.match(settings.quietHours.endTime, /^([01]\d|2[0-3]):[0-5]\d$/, "default end time is normalized");
  assert.equal(isQuietHoursActive(quietHours, new Date("2026-08-16T23:30:00")), true, "overnight quiet hours are active before midnight");
  assert.equal(isQuietHoursActive(quietHours, new Date("2026-08-16T06:30:00")), true, "overnight quiet hours are active after midnight");
  assert.equal(isQuietHoursActive(quietHours, new Date("2026-08-16T12:30:00")), false, "quiet hours end at the configured local time");
  assert.equal(quietHoursSuppressesDesktop(configured, false, "direct_message", new Date("2026-08-16T23:30:00")), true, "all-notification policy suppresses desktop delivery");
  assert.equal(quietHoursSuppressesDesktop({ ...configured, quietHours: { ...quietHours, allowMentions: true } }, true, "mention", new Date("2026-08-16T23:30:00")), false, "mention override remains truthful");
  assert.equal(quietHoursSuppressesDesktop({ ...configured, quietHours: { ...quietHours, applyTo: "normal_messages_only" } }, false, "incoming_call", new Date("2026-08-16T23:30:00")), false, "normal-message policy does not suppress calls");
  assert.equal(quietHoursShouldSilence({ ...configured, quietHours: { ...quietHours, applyTo: "sounds_only" } }, false, new Date("2026-08-16T23:30:00")), true, "sounds-only quiet hours do not claim to block delivery");
  console.log("Quiet Hours runtime smoke test passed.");
} finally {
  await vite.close();
}
