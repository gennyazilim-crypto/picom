import assert from "node:assert/strict";

const firstLaunch = await import("../src/services/firstLaunchSetupState.ts");

const { FIRST_LAUNCH_SETUP_VERSION, createFirstLaunchSetupState, normalizeFirstLaunchSetupState, updateFirstLaunchSetupState } = firstLaunch;

const started = createFirstLaunchSetupState({ locale: "en", theme: "system" }, "2026-08-16T10:00:00.000Z");
assert.equal(started.version, FIRST_LAUNCH_SETUP_VERSION);
assert.equal(started.completed, false);
assert.equal(started.currentStep, "welcome");

const resumed = normalizeFirstLaunchSetupState(
  { version: FIRST_LAUNCH_SETUP_VERSION, completed: false, currentStep: "appearance", locale: "tr", theme: "dark", updatedAt: "2026-08-16T10:01:00.000Z" },
  { locale: "en", theme: "system", completed: false },
  "2026-08-16T10:02:00.000Z",
);
assert.equal(resumed.currentStep, "appearance");
assert.equal(resumed.locale, "tr");
assert.equal(resumed.theme, "dark");
assert.equal(updateFirstLaunchSetupState(resumed, { currentStep: "welcome" }, "2026-08-16T10:03:00.000Z").currentStep, "welcome");

class MemoryStorage {
  #values = new Map();
  getItem(key) { return this.#values.get(key) ?? null; }
  setItem(key, value) { this.#values.set(key, String(value)); }
}

// A JSON/localStorage round trip models process interruption without relying on source text.
const storage = new MemoryStorage();
storage.setItem("picom-settings", JSON.stringify({ firstLaunchSetup: resumed }));
const restored = normalizeFirstLaunchSetupState(
  JSON.parse(storage.getItem("picom-settings")).firstLaunchSetup,
  { locale: "en", theme: "system", completed: false },
  "2026-08-16T10:04:00.000Z",
);
assert.deepEqual(
  { currentStep: restored.currentStep, locale: restored.locale, theme: restored.theme },
  { currentStep: "appearance", locale: "tr", theme: "dark" },
);

const completed = normalizeFirstLaunchSetupState(
  { ...resumed, completed: true, currentStep: "permissions" },
  { locale: "en", theme: "system", completed: false },
  "2026-08-16T10:05:00.000Z",
);
assert.equal(completed.completed, true);
assert.equal(completed.currentStep, "ready");

const corrupt = normalizeFirstLaunchSetupState(
  { version: FIRST_LAUNCH_SETUP_VERSION, completed: false, currentStep: "not-a-step", locale: "unsupported", theme: "neon", updatedAt: "invalid" },
  { locale: "tr", theme: "dark", completed: false },
  "2026-08-16T10:06:00.000Z",
);
assert.deepEqual(
  { currentStep: corrupt.currentStep, locale: corrupt.locale, theme: corrupt.theme, updatedAt: corrupt.updatedAt },
  { currentStep: "welcome", locale: "tr", theme: "dark", updatedAt: "2026-08-16T10:06:00.000Z" },
);

const newer = normalizeFirstLaunchSetupState(
  { version: 999, completed: true, currentStep: "permissions", locale: "ru", theme: "dark", updatedAt: "2026-08-16T10:01:00.000Z" },
  { locale: "en", theme: "system", completed: false },
  "2026-08-16T10:07:00.000Z",
);
assert.deepEqual(
  { version: newer.version, completed: newer.completed, currentStep: newer.currentStep, locale: newer.locale, theme: newer.theme },
  { version: FIRST_LAUNCH_SETUP_VERSION, completed: true, currentStep: "ready", locale: "ru", theme: "dark" },
);

const purposes = normalizeFirstLaunchSetupState(
  { version: FIRST_LAUNCH_SETUP_VERSION, completed: false, currentStep: "personalize", locale: "en", theme: "dark", purposeIds: ["gaming", "garbage", "", "gaming"], reviewAllSetup: "yes" },
  { locale: "en", theme: "system", completed: false },
  "2026-08-16T10:08:00.000Z",
);
assert.deepEqual([...purposes.purposeIds], ["gaming"]);
assert.equal(purposes.reviewAllSetup, false);

const completedPurge = firstLaunch.completeFirstLaunchSetupState(purposes, "2026-08-16T10:09:00.000Z");
assert.equal(completedPurge.completed, true);
assert.deepEqual([...completedPurge.purposeIds], []);
assert.equal(completedPurge.theme, "dark");

console.log("First-launch setup state reducer and JSON persistence runtime tests passed.");
