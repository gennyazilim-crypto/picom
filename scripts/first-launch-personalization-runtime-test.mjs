import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const personalization = await import("../src/services/firstLaunchPersonalization.ts");
const state = await import("../src/services/firstLaunchSetupState.ts");
const steps = await import("../src/services/firstLaunchSetupSteps.ts");

const {
  FIRST_LAUNCH_PURPOSE_IDS,
  FIRST_LAUNCH_PURPOSE_OPTIONAL_STEPS,
  FIRST_LAUNCH_NO_SELECTION_BEHAVIOR,
  PERSONALIZATION_RETENTION_AFTER_COMPLETION,
  assertFirstLaunchPurposeMapping,
  getGuidedPlanProgress,
  getNextIncludedStep,
  getPreviousIncludedStep,
  nearestIncludedStep,
  resolveFirstLaunchPlan,
  sanitizeFirstLaunchPurposeIds,
  sanitizeReviewAllSetup,
} = personalization;

const {
  FIRST_LAUNCH_SETUP_VERSION,
  completeFirstLaunchSetupState,
  createFirstLaunchSetupState,
  normalizeFirstLaunchSetupState,
  skipFirstLaunchSetupStep,
  updateFirstLaunchSetupState,
} = state;

const { FIRST_LAUNCH_STEP_IDS, FIRST_LAUNCH_STEP_REGISTRY, getFirstLaunchStepNavigationStatus } = steps;

assertFirstLaunchPurposeMapping();

// CASE 01
assert.deepEqual([...FIRST_LAUNCH_PURPOSE_IDS], ["friends", "communities", "gaming", "work", "creator"]);

// CASE 02 / 03 / 36
assert.deepEqual(sanitizeFirstLaunchPurposeIds(["gaming", "garbage", "", "gaming"]), ["gaming"]);
assert.deepEqual(sanitizeFirstLaunchPurposeIds("not-an-array"), []);
assert.deepEqual(sanitizeFirstLaunchPurposeIds(null), []);
assert.equal(sanitizeReviewAllSetup("yes"), false);
assert.equal(sanitizeReviewAllSetup(true), true);

// CASE 04 / 05
const draft = createFirstLaunchSetupState({ locale: "en", theme: "dark" }, "2026-08-16T20:00:00.000Z");
const selected = updateFirstLaunchSetupState(draft, { purposeIds: ["gaming", "friends"] }, "2026-08-16T20:01:00.000Z");
assert.deepEqual([...selected.purposeIds], ["gaming", "friends"]);
const restored = normalizeFirstLaunchSetupState(
  JSON.parse(JSON.stringify(selected)),
  { locale: "en", theme: "system", completed: false },
  "2026-08-16T20:02:00.000Z",
);
assert.deepEqual([...restored.purposeIds], ["gaming", "friends"]);
assert.equal(restored.currentStep, "welcome");

const legacyInterests = normalizeFirstLaunchSetupState(
  { version: 2, completed: false, currentStep: "personalize", locale: "tr", theme: "light", personalization: ["friends-communication", "work-team", "unknown"], skippedStepIds: [] },
  { locale: "en", theme: "system", completed: false },
  "2026-08-16T20:03:00.000Z",
);
assert.deepEqual([...legacyInterests.purposeIds], ["friends", "work"]);

// CASE 06-12
assert.deepEqual([...resolveFirstLaunchPlan({ selectedPurposeIds: ["friends"] }).omittedOptionalStepIds], ["desktop"]);
assert.deepEqual(
  [...resolveFirstLaunchPlan({ selectedPurposeIds: ["friends"] }).includedStepIds],
  ["welcome", "personalize", "appearance", "audio-video", "notifications", "privacy", "ready"],
);
assert.deepEqual(
  [...resolveFirstLaunchPlan({ selectedPurposeIds: ["communities"] }).includedStepIds],
  ["welcome", "personalize", "appearance", "notifications", "privacy", "ready"],
);
assert.deepEqual(
  [...resolveFirstLaunchPlan({ selectedPurposeIds: ["gaming"] }).includedStepIds],
  ["welcome", "personalize", "appearance", "audio-video", "desktop", "notifications", "ready"],
);
assert.deepEqual(
  [...resolveFirstLaunchPlan({ selectedPurposeIds: ["work"] }).includedStepIds],
  ["welcome", "personalize", "appearance", "audio-video", "desktop", "notifications", "privacy", "ready"],
);
assert.deepEqual(
  [...resolveFirstLaunchPlan({ selectedPurposeIds: ["creator"] }).includedStepIds],
  ["welcome", "personalize", "appearance", "audio-video", "notifications", "privacy", "ready"],
);
const union = resolveFirstLaunchPlan({ selectedPurposeIds: ["gaming", "friends"] });
assert.deepEqual(
  [...union.includedStepIds],
  ["welcome", "personalize", "appearance", "audio-video", "desktop", "notifications", "privacy", "ready"],
);
assert.deepEqual([...FIRST_LAUNCH_PURPOSE_OPTIONAL_STEPS.friends], ["audio-video", "notifications", "privacy"]);
assert.deepEqual([...FIRST_LAUNCH_PURPOSE_OPTIONAL_STEPS.communities], ["notifications", "privacy"]);
assert.deepEqual([...FIRST_LAUNCH_PURPOSE_OPTIONAL_STEPS.gaming], ["audio-video", "desktop", "notifications"]);
assert.deepEqual([...FIRST_LAUNCH_PURPOSE_OPTIONAL_STEPS.work], ["audio-video", "desktop", "notifications", "privacy"]);
assert.deepEqual([...FIRST_LAUNCH_PURPOSE_OPTIONAL_STEPS.creator], ["audio-video", "notifications", "privacy"]);

// CASE 13-16
for (const purposeId of FIRST_LAUNCH_PURPOSE_IDS) {
  const plan = resolveFirstLaunchPlan({ selectedPurposeIds: [purposeId] });
  for (const required of ["welcome", "personalize", "appearance", "ready"]) {
    assert.ok(plan.includedStepIds.includes(required), `${purposeId} must keep ${required}`);
  }
}

// CASE 17-20
const reviewAll = resolveFirstLaunchPlan({ selectedPurposeIds: ["communities"], reviewAllSetup: true });
assert.deepEqual([...reviewAll.includedStepIds], [...FIRST_LAUNCH_STEP_IDS]);
const purposeOnly = resolveFirstLaunchPlan({ selectedPurposeIds: ["communities"], reviewAllSetup: false });
assert.deepEqual([...purposeOnly.includedStepIds], ["welcome", "personalize", "appearance", "notifications", "privacy", "ready"]);
const skippedKept = updateFirstLaunchSetupState(
  updateFirstLaunchSetupState(draft, { skippedStepIds: ["audio-video"], reviewAllSetup: true }),
  { reviewAllSetup: false },
);
assert.deepEqual([...skippedKept.skippedStepIds], ["audio-video"]);
assert.equal(skippedKept.theme, "dark");

// CASE 21-24
const omittedSkip = skipFirstLaunchSetupStep(draft, "desktop");
assert.deepEqual([...omittedSkip.skippedStepIds], []);
const gamingState = updateFirstLaunchSetupState(draft, { purposeIds: ["gaming"], currentStep: "audio-video" });
const explicitSkip = skipFirstLaunchSetupStep(gamingState, "audio-video");
assert.deepEqual([...explicitSkip.skippedStepIds], ["audio-video"]);
assert.equal(explicitSkip.currentStep, "desktop");
assert.equal(
  getFirstLaunchStepNavigationStatus("privacy", "ready", [], resolveFirstLaunchPlan({ selectedPurposeIds: ["gaming"] }).includedStepIds),
  "omitted",
);
assert.notEqual(
  getFirstLaunchStepNavigationStatus("privacy", "ready", [], resolveFirstLaunchPlan({ selectedPurposeIds: ["gaming"] }).includedStepIds),
  "completed",
);
assert.notEqual(
  getFirstLaunchStepNavigationStatus("privacy", "ready", [], resolveFirstLaunchPlan({ selectedPurposeIds: ["gaming"] }).includedStepIds),
  "skipped",
);

// CASE 25-29
assert.equal(FIRST_LAUNCH_NO_SELECTION_BEHAVIOR, "MINIMAL_GUIDED_PLAN");
const emptyPlan = resolveFirstLaunchPlan({ selectedPurposeIds: [] });
assert.deepEqual([...emptyPlan.includedStepIds], ["welcome", "personalize", "appearance", "ready"]);
assert.deepEqual(getGuidedPlanProgress("appearance", emptyPlan.includedStepIds), { current: 3, total: 4 });
assert.deepEqual(getGuidedPlanProgress("desktop", resolveFirstLaunchPlan({ selectedPurposeIds: ["gaming"] }).includedStepIds), { current: 5, total: 7 });
assert.deepEqual(getGuidedPlanProgress("privacy", resolveFirstLaunchPlan({ reviewAllSetup: true }).includedStepIds), { current: 7, total: 8 });

// CASE 30-35
const gamingPlan = resolveFirstLaunchPlan({ selectedPurposeIds: ["gaming"] });
assert.equal(getNextIncludedStep("notifications", gamingPlan.includedStepIds)?.id, "ready");
assert.equal(getPreviousIncludedStep("ready", gamingPlan.includedStepIds)?.id, "notifications");
assert.equal(getNextIncludedStep("appearance", gamingPlan.includedStepIds)?.id, "audio-video");
assert.equal(getPreviousIncludedStep("welcome", gamingPlan.includedStepIds), undefined);
assert.equal(nearestIncludedStep("privacy", gamingPlan.includedStepIds), "notifications");
assert.equal(nearestIncludedStep("desktop", emptyPlan.includedStepIds), "appearance");
const onPersonalize = updateFirstLaunchSetupState(gamingState, { currentStep: "personalize", purposeIds: ["communities"] });
assert.equal(onPersonalize.currentStep, "personalize", "CASE 34: purpose change on Personalize does not auto-navigate");
assert.equal(getNextIncludedStep("personalize", resolveFirstLaunchPlan(onPersonalize).includedStepIds)?.id, "appearance");
assert.equal(getNextIncludedStep("appearance", resolveFirstLaunchPlan(onPersonalize).includedStepIds)?.id, "notifications");
const resumedExcluded = normalizeFirstLaunchSetupState(
  { version: 3, completed: false, currentStep: "desktop", locale: "en", theme: "dark", purposeIds: ["communities"], skippedStepIds: [] },
  { locale: "en", theme: "system", completed: false },
  "2026-08-16T20:04:00.000Z",
);
assert.equal(resumedExcluded.currentStep, "appearance", "CASE 33: excluded persisted currentStep normalizes safely");

// CASE 36-44 settings safety: purpose patches only touch adaptive fields
const before = updateFirstLaunchSetupState(draft, { theme: "light", locale: "tr", purposeIds: ["gaming"] });
const afterPurposeChange = updateFirstLaunchSetupState(before, { purposeIds: ["work"] });
assert.equal(afterPurposeChange.theme, "light");
assert.equal(afterPurposeChange.locale, "tr");
assert.deepEqual([...afterPurposeChange.skippedStepIds], [...before.skippedStepIds]);

const setupSource = readFileSync("src/components/firstLaunch/FirstLaunchSetup.tsx", "utf8");
const personalizeSource = readFileSync("src/components/firstLaunch/FirstLaunchPersonalize.tsx", "utf8");
const engineSource = readFileSync("src/services/firstLaunchPersonalization.ts", "utf8");
const stateSource = readFileSync("src/services/firstLaunchSetupState.ts", "utf8");
const onboardingSource = readFileSync("src/services/onboarding/onboardingService.ts", "utf8");
const onboardingFlow = readFileSync("src/components/onboarding/OnboardingFlow.tsx", "utf8");
assert.ok(!/getUserMedia|desktopCapturer|requestPermission|startScreenShare|getDisplayMedia/.test(personalizeSource));
assert.ok(!/voiceDeviceService|desktopBehaviorService|notificationService|accountPrivacySetupService/.test(personalizeSource));
assert.ok(!/getUserMedia|desktopCapturer|requestPermission/.test(engineSource));
assert.equal(setupSource.includes("togglePurpose"), true);
assert.ok(!setupSource.includes("friends-communication"));
assert.match(setupSource, /aria-valuemax=\{totalSteps\}/);
assert.match(setupSource, /getNextIncludedStep/);
assert.match(setupSource, /getPreviousIncludedStep/);
assert.match(personalizeSource, /type="checkbox"/);
assert.match(personalizeSource, /is-selected/);

// CASE 45-47
assert.ok(!FIRST_LAUNCH_PURPOSE_OPTIONAL_STEPS.gaming.includes("privacy"));
assert.ok(FIRST_LAUNCH_PURPOSE_OPTIONAL_STEPS.friends.includes("privacy"));
assert.ok(setupSource.includes("FirstLaunchPrivacySetup"));
assert.ok(setupSource.includes("omittedByPlan.includes(\"privacy\")"));

// CASE 48-51
const completed = completeFirstLaunchSetupState(selected, "2026-08-16T20:05:00.000Z");
assert.equal(completed.completed, true);
assert.deepEqual([...completed.purposeIds], []);
assert.equal(completed.reviewAllSetup, false);
assert.equal(completed.theme, "dark");
assert.equal(PERSONALIZATION_RETENTION_AFTER_COMPLETION, "CLEARED");
const legacyCompleted = normalizeFirstLaunchSetupState(
  { version: 2, completed: true, currentStep: "ready", locale: "ru", theme: "dark", personalization: ["gaming"] },
  { locale: "en", theme: "system", completed: false },
  "2026-08-16T20:06:00.000Z",
);
assert.equal(legacyCompleted.completed, true);
assert.equal(legacyCompleted.currentStep, "ready");
assert.deepEqual([...legacyCompleted.purposeIds], []);
assert.equal(FIRST_LAUNCH_SETUP_VERSION, 3);

// CASE 52-55
assert.ok(!engineSource.includes("supabase"));
assert.ok(!stateSource.includes("supabase"));
assert.ok(!/purposeIds|firstLaunchPurpose|personalization/.test(onboardingSource));
assert.ok(!/purposeIds|firstLaunchPurpose/.test(onboardingFlow));
assert.ok(stateSource.includes("device-only") || stateSource.includes("device-local") || stateSource.includes("unfinished device"));

// CASE 56-59 source-level accessibility
assert.match(personalizeSource, /<input\s+[\s\S]*type="checkbox"/);
assert.match(personalizeSource, /first-launch-purpose-check/);
assert.ok(!personalizeSource.includes("aria-live=\"assertive\""));
assert.ok(!personalizeSource.includes("aria-live=\"polite\""));

assert.equal(FIRST_LAUNCH_STEP_REGISTRY.length, 8);
assert.deepEqual(FIRST_LAUNCH_STEP_REGISTRY.map((step) => step.id), [...FIRST_LAUNCH_STEP_IDS]);

console.log("First-launch adaptive personalization runtime: purpose model, plan resolver, navigation, and retention cases passed.");
