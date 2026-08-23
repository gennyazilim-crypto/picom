import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const policy = require("../electron/desktopBehaviorPolicy.cjs");

let stored = {
  startupVisibility: "normal",
  closeBehavior: "tray",
  startupDestination: "last",
  lastSafeLocation: null,
};
let nativeStartupEnabled = false;
let nativeStartupSupported = true;
let failNativeStartupUpdate = false;
let trayWorks = true;
let runtimePlatform = "win32";

globalThis.window = {
  picomDesktop: {
    settings: {
      get: async () => ({ ok: true, native: true, settings: { ...stored } }),
      set: async (patch) => {
        stored = { ...stored, ...patch };
        return { ok: true, native: true, settings: { ...stored } };
      },
    },
    startup: {
      getState: async () => ({ ok: true, native: true, supported: nativeStartupSupported, enabled: nativeStartupEnabled }),
      setEnabled: async (enabled) => {
        if (failNativeStartupUpdate) return { ok: false, native: true, error: "STARTUP_UPDATE_FAILED" };
        nativeStartupEnabled = enabled;
        return { ok: true, native: true, supported: true, enabled };
      },
    },
    tray: {
      setCloseToTray: async (enabled) => trayWorks
        ? { ok: true, native: true, enabled, supported: true }
        : { ok: true, native: true, enabled: false, supported: false },
    },
    getRuntimeInfo: () => ({ platform: runtimePlatform }),
  },
};

const desktop = await import("../src/services/desktop/desktopBehaviorService.ts");
const {
  desktopBehaviorService,
  canPersistDesktopSafeLocation,
  normalizeDesktopBehaviorPreferences,
  resolveDesktopStartupDestination,
} = desktop;

// Canonical enum sanitization and migration from the previous boolean fields.
assert.deepEqual(normalizeDesktopBehaviorPreferences({ launchMinimized: true, closeToTray: false, startupDestination: "messages", lastSafeLocation: "messages" }), {
  startupVisibility: "tray",
  closeBehavior: "quit",
  startupDestination: "messages",
  lastSafeLocation: "messages",
});
assert.deepEqual(normalizeDesktopBehaviorPreferences({ startupVisibility: "unknown", closeBehavior: "hidden", startupDestination: "dm:private", lastSafeLocation: "dm:private" }), {
  startupVisibility: "normal",
  closeBehavior: "tray",
  startupDestination: "last",
  lastSafeLocation: null,
});

let current = await desktopBehaviorService.refresh();
assert.equal(current.startupCapability, "supported", "native launch-at-login state must be read from the approved bridge");
assert.equal(current.launchAtStartup, false);

nativeStartupSupported = false;
runtimePlatform = "linux";
current = await desktopBehaviorService.refresh();
assert.equal(current.startupCapability, "unsupported", "Linux must be presented as an unsupported platform, not a usable native setting");
runtimePlatform = "win32";
current = await desktopBehaviorService.refresh();
assert.equal(current.startupCapability, "dev-unavailable", "Windows development mode must not claim a native startup registration");
nativeStartupSupported = true;
current = await desktopBehaviorService.refresh();

current = await desktopBehaviorService.setLaunchAtStartup(true);
assert.equal(current.launchAtStartup, true, "native confirmation is required before startup is reported enabled");
current = await desktopBehaviorService.setLaunchAtStartup(false);
assert.equal(current.launchAtStartup, false, "native disable is reflected from the approved bridge");

failNativeStartupUpdate = true;
current = await desktopBehaviorService.setLaunchAtStartup(true);
assert.equal(current.launchAtStartup, false, "failed native startup updates must fail closed");
assert.equal(current.startupCapability, "unavailable");
failNativeStartupUpdate = false;
await desktopBehaviorService.refresh();

current = await desktopBehaviorService.updatePreferences({ startupVisibility: "tray", closeBehavior: "tray", startupDestination: "messages" });
assert.equal(current.startupVisibility, "tray");
assert.equal(current.closeBehavior, "tray");
assert.equal(current.startupDestination, "messages");
assert.equal(stored.launchMinimized, true, "legacy native startup flag follows the canonical visibility choice");
assert.equal(stored.closeToTray, true, "legacy native close flag follows the canonical close choice");

trayWorks = false;
current = await desktopBehaviorService.updatePreferences({ closeBehavior: "tray" });
assert.equal(current.closeBehavior, "quit", "an unavailable tray must fall back to a visible, quit-on-close path");
assert.equal(stored.closeBehavior, "quit");
trayWorks = true;

await desktopBehaviorService.rememberSafeLocation("communities");
assert.equal(stored.lastSafeLocation, "communities", "only a high-level safe location is persisted");
await desktopBehaviorService.rememberSafeLocation("directMessages:private-thread");
assert.equal(stored.lastSafeLocation, "communities", "private route details must never be persisted as last location");

// Gates and explicit interaction always beat passive startup preferences.
assert.equal(resolveDesktopStartupDestination({ firstLaunchRequired: true, authenticationRequired: false, accountOnboardingRequired: false, startupDestination: "messages" }), null);
assert.equal(resolveDesktopStartupDestination({ firstLaunchRequired: false, authenticationRequired: true, accountOnboardingRequired: false, startupDestination: "messages" }), null);
assert.equal(resolveDesktopStartupDestination({ firstLaunchRequired: false, authenticationRequired: false, accountOnboardingRequired: true, startupDestination: "messages" }), null);
assert.equal(resolveDesktopStartupDestination({ firstLaunchRequired: false, authenticationRequired: false, accountOnboardingRequired: false, explicitDestination: "communities", startupDestination: "messages" }), "communities");
assert.equal(resolveDesktopStartupDestination({ firstLaunchRequired: false, authenticationRequired: false, accountOnboardingRequired: false, startupDestination: "last", lastSafeLocation: "messages" }), "messages");
assert.equal(resolveDesktopStartupDestination({ firstLaunchRequired: false, authenticationRequired: false, accountOnboardingRequired: false, startupDestination: "last", lastSafeLocation: null }), "feed");
assert.equal(canPersistDesktopSafeLocation({ userId: "user-a", startupRouteAppliedForUserId: null, destination: "feed" }), false, "the default first render cannot overwrite a saved last location");
assert.equal(canPersistDesktopSafeLocation({ userId: "user-a", startupRouteAppliedForUserId: "user-b", destination: "feed" }), false, "a previous account's routing state cannot write for the next account");
assert.equal(canPersistDesktopSafeLocation({ userId: "user-a", startupRouteAppliedForUserId: "user-a", destination: "messages" }), true, "safe locations persist only after the current account's startup routing resolves");

// This policy is used directly by electron/main.cts for lifecycle decisions.
assert.equal(policy.shouldStartHiddenInTray({ trayReady: true, loginStartup: true, explicitLaunchIntent: false, settings: { startupVisibility: "tray" } }), true);
assert.equal(policy.shouldStartHiddenInTray({ trayReady: false, loginStartup: true, explicitLaunchIntent: false, settings: { startupVisibility: "tray" } }), false, "a missing tray must never leave PICOM invisible");
assert.equal(policy.shouldStartHiddenInTray({ trayReady: true, loginStartup: false, explicitLaunchIntent: false, settings: { startupVisibility: "tray" } }), false, "manual launches must remain visible");
assert.equal(policy.shouldStartHiddenInTray({ trayReady: true, loginStartup: true, explicitLaunchIntent: true, settings: { startupVisibility: "tray" } }), false, "a deep link/notification launch must surface the app");
assert.equal(policy.shouldInterceptMainWindowClose({ isQuitting: false, closeBehavior: "tray", trayReady: true }), true);
assert.equal(policy.shouldInterceptMainWindowClose({ isQuitting: true, closeBehavior: "tray", trayReady: true }), false, "intentional quits must not be intercepted");
assert.equal(policy.shouldInterceptMainWindowClose({ isQuitting: false, closeBehavior: "tray", trayReady: false }), false, "a missing tray must not hide the only recovery path");
assert.equal(policy.shouldInterceptMainWindowClose({ isQuitting: false, closeBehavior: "quit", trayReady: true }), false);

console.log("First-launch desktop behavior persistence, routing, startup, tray fallback, and lifecycle runtime tests passed.");
