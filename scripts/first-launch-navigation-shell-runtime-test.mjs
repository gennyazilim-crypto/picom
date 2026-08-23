import assert from "node:assert/strict";

const steps = await import("../src/services/firstLaunchSetupSteps.ts");
const state = await import("../src/services/firstLaunchSetupState.ts");

const { FIRST_LAUNCH_STEP_REGISTRY, getFirstLaunchStep, getFirstLaunchStepNavigationStatus, getNextFirstLaunchStep, getPreviousFirstLaunchStep } = steps;
const { FIRST_LAUNCH_SETUP_VERSION, normalizeFirstLaunchSetupState, skipFirstLaunchSetupStep, updateFirstLaunchSetupState } = state;

assert.deepEqual(
  FIRST_LAUNCH_STEP_REGISTRY.map((step) => step.id),
  ["welcome", "personalize", "appearance", "audio-video", "desktop", "notifications", "privacy", "ready"],
  "eight canonical first-launch steps must have stable IDs and order",
);
assert.equal(new Set(FIRST_LAUNCH_STEP_REGISTRY.map((step) => step.id)).size, 8, "step IDs must be unique");
assert.equal(getFirstLaunchStep("personalize")?.optional, true);
assert.equal(getFirstLaunchStep("appearance")?.optional, false);
assert.equal(getNextFirstLaunchStep("appearance")?.id, "audio-video");
assert.equal(getPreviousFirstLaunchStep("appearance")?.id, "personalize");
assert.equal(getFirstLaunchStepNavigationStatus("appearance", "privacy", []), "completed");
assert.equal(getFirstLaunchStepNavigationStatus("audio-video", "privacy", ["audio-video"]), "skipped");
assert.equal(getFirstLaunchStepNavigationStatus("ready", "privacy", []), "upcoming");
assert.equal(getFirstLaunchStepNavigationStatus("privacy", "privacy", []), "current");

const migratedPermissions = normalizeFirstLaunchSetupState(
  { version: 1, completed: false, currentStep: "permissions", locale: "tr", theme: "dark", updatedAt: "2026-08-16T11:00:00.000Z" },
  { locale: "en", theme: "system", completed: false },
  "2026-08-16T11:01:00.000Z",
);
assert.deepEqual(
  { version: migratedPermissions.version, step: migratedPermissions.currentStep, locale: migratedPermissions.locale, theme: migratedPermissions.theme },
  { version: FIRST_LAUNCH_SETUP_VERSION, step: "notifications", locale: "tr", theme: "dark" },
);

const migratedCompleted = normalizeFirstLaunchSetupState(
  { version: 1, completed: true, currentStep: "ready", locale: "en", theme: "system", updatedAt: "2026-08-16T11:00:00.000Z" },
  { locale: "en", theme: "system", completed: false },
  "2026-08-16T11:01:00.000Z",
);
assert.deepEqual({ completed: migratedCompleted.completed, step: migratedCompleted.currentStep }, { completed: true, step: "ready" });

const resumed = updateFirstLaunchSetupState(migratedPermissions, { currentStep: "privacy" }, "2026-08-16T11:02:00.000Z");
assert.equal(resumed.currentStep, "privacy", "canonical step IDs must resume directly");
const skipped = skipFirstLaunchSetupStep(resumed, "privacy", "2026-08-16T11:03:00.000Z");
assert.deepEqual({ step: skipped.currentStep, skipped: skipped.skippedStepIds }, { step: "ready", skipped: ["privacy"] });
assert.equal(skipped.completed, false, "skipping must not mark setup complete");

console.log("First-launch eight-step registry, migration, resume, and skip runtime tests passed.");
