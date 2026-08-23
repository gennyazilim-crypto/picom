import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ready = await import("../src/services/firstLaunchReadyState.ts");
const actions = await import("../src/services/firstLaunchProductActions.ts");
const handoff = await import("../src/services/firstLaunchHandoffIntent.ts");
const completion = await import("../src/services/firstLaunchCompletion.ts");
const review = await import("../src/services/firstLaunchReadyReview.ts");
const cleanup = await import("../src/services/firstLaunchMediaCleanupRegistry.ts");
const state = await import("../src/services/firstLaunchSetupState.ts");
const personalization = await import("../src/services/firstLaunchPersonalization.ts");
const desktop = await import("../src/services/desktop/desktopBehaviorService.ts");

const {
  READY_COMPLETION_BLOCKER_POLICY,
  resolveFirstLaunchReadyState,
  resolveFirstLaunchCompletionBlockers,
  resolveFirstLaunchNextGate,
} = ready;
const {
  FIRST_PRODUCT_ACTION_MODE,
  resolveFirstProductActions,
  sanitizeFirstProductActionId,
  toFirstProductActionDestination,
} = actions;
const {
  setFirstLaunchHandoffIntent,
  peekFirstLaunchHandoffIntent,
  consumeFirstLaunchHandoffIntent,
  clearFirstLaunchHandoffIntent,
  resolveFirstLaunchRouteDecision,
} = handoff;
const { commitFirstLaunchCompletion, firstLaunchCompletionPreservesProductSettings } = completion;
const { reviewFirstLaunchStep } = review;
const { registerFirstLaunchMediaCleanup, runRegisteredFirstLaunchMediaCleanups } = cleanup;
const { createFirstLaunchSetupState, completeFirstLaunchSetupState, updateFirstLaunchSetupState } = state;
const { PERSONALIZATION_RETENTION_AFTER_COMPLETION } = personalization;
const { resolveDesktopStartupDestination } = desktop;

function baseInput(overrides = {}) {
  return {
    locale: "en",
    theme: "dark",
    density: "comfortable",
    textSize: "default",
    interfaceScale: 1,
    purposeIds: ["work"],
    reviewAllSetup: false,
    skippedStepIds: [],
    audio: {
      permission: "granted",
      setupStatus: "granted",
      selectedInputId: "mic-1",
      selectedOutputId: "spk-1",
      inputPresent: true,
      outputPresent: true,
      microphoneTestPassed: true,
      microphoneTestAttempted: true,
    },
    camera: {
      permission: "granted",
      selectedPresent: true,
      previewActive: false,
      attempted: true,
      passed: true,
      skipped: false,
      errorCode: null,
    },
    screen: { attempted: true, passed: true, skipped: false, blocked: false, unavailable: false },
    desktop: {
      launchAtStartup: false,
      startupVisibility: "normal",
      closeBehavior: "quit",
      startupDestination: "feed",
      startupCapability: "supported",
    },
    notifications: { capability: "native-available", quietHoursEnabled: false, doNotDisturb: false },
    privacy: { status: "anonymous" },
    session: { authenticated: false, legalAccepted: false, onboardingComplete: false },
    ...overrides,
  };
}

function row(resolved, id) {
  return resolved.sections.flatMap((section) => section.rows).find((item) => item.id === id);
}

// CASE 01 / 02
const canonical = resolveFirstLaunchReadyState(baseInput());
assert.equal(row(canonical, "theme")?.valueKey, "theme.dark");
assert.equal(row(canonical, "microphone")?.status, "tested");
assert.equal(canonical.canComplete, true);
assert.doesNotMatch(JSON.stringify(canonical), /everything is working|100%|fake success/i);

// CASE 03
const configuredOnly = resolveFirstLaunchReadyState(baseInput({
  audio: { ...baseInput().audio, microphoneTestPassed: false, microphoneTestAttempted: false },
  camera: { ...baseInput().camera, passed: false, attempted: false, previewActive: false },
}));
assert.equal(row(configuredOnly, "microphone")?.status, "configured");
assert.equal(row(configuredOnly, "camera")?.status, "configured");
assert.notEqual(row(configuredOnly, "microphone")?.status, "tested");

// CASE 04
const skipped = resolveFirstLaunchReadyState(baseInput({ skippedStepIds: ["audio-video"] }));
assert.equal(skipped.sections.find((section) => section.id === "audio-video")?.participation, "skipped");
assert.equal(row(skipped, "audio-skipped")?.status, "skipped");
assert.equal(row(skipped, "audio-skipped")?.severity, "neutral");

// CASE 05
const omitted = resolveFirstLaunchReadyState(baseInput({ purposeIds: ["communities"] }));
assert.equal(omitted.sections.find((section) => section.id === "desktop")?.participation, "omitted");
assert.equal(row(omitted, "desktop-omitted")?.status, "not-in-plan");
assert.equal(row(omitted, "desktop-omitted")?.severity, "neutral");
assert.ok(omitted.omittedSectionIds.includes("desktop"));
assert.ok(!omitted.omittedSectionIds.includes("notifications"));

// CASE 06
assert.equal(row(canonical, "privacy-deferred")?.status, "deferred");
assert.equal(row(canonical, "privacy-deferred")?.valueKey, "privacy.reviewAfterSignIn");

// CASE 07
const unavailable = resolveFirstLaunchReadyState(baseInput({
  audio: { ...baseInput().audio, inputPresent: false, microphoneTestPassed: true },
}));
assert.equal(row(unavailable, "microphone")?.status, "unavailable");
assert.equal(row(unavailable, "microphone")?.severity, "attention");

// CASE 08 stale mic
assert.notEqual(row(unavailable, "microphone")?.status, "tested");

// CASE 09 removed camera
const removedCamera = resolveFirstLaunchReadyState(baseInput({
  camera: { ...baseInput().camera, selectedPresent: false, previewActive: false, passed: true, errorCode: "CAMERA_MISSING" },
}));
assert.equal(row(removedCamera, "camera")?.status, "unavailable");

// CASE 10 failed screen
const failedScreen = resolveFirstLaunchReadyState(baseInput({
  screen: { attempted: true, passed: false, skipped: false, blocked: false, unavailable: false },
}));
assert.equal(row(failedScreen, "screen")?.status, "not-tested");
const blockedScreen = resolveFirstLaunchReadyState(baseInput({
  screen: { attempted: true, passed: false, skipped: false, blocked: true, unavailable: false },
}));
assert.equal(row(blockedScreen, "screen")?.status, "blocked");

// CASE 11 failed launch-at-startup
const failedStartup = resolveFirstLaunchReadyState(baseInput({
  desktop: { ...baseInput().desktop, launchAtStartup: false, startupCapability: "unavailable" },
}));
assert.equal(row(failedStartup, "launchAtStartup")?.valueKey, "desktop.summaryOff");
assert.notEqual(row(failedStartup, "launchAtStartup")?.valueKey, "desktop.summaryOn");

// CASE 12 failed privacy mutation
const privacyFailed = resolveFirstLaunchReadyState(baseInput({
  session: { authenticated: true, legalAccepted: true, onboardingComplete: true },
  privacy: { status: "unavailable" },
}));
assert.equal(row(privacyFailed, "privacy-unavailable")?.status, "unavailable");
assert.notEqual(row(privacyFailed, "privacy-unavailable")?.status, "configured");

// CASE 13-16 review targets
assert.equal(row(canonical, "microphone")?.reviewStepId, "audio-video");
assert.equal(row(canonical, "camera")?.reviewStepId, "audio-video");
assert.equal(row(canonical, "launchAtStartup")?.reviewStepId, "desktop");
assert.equal(row(canonical, "delivery")?.reviewStepId, "notifications");
assert.equal(row(canonical, "privacy-deferred")?.reviewStepId, "privacy");

// CASE 17 omitted step reachable without skip
const draft = createFirstLaunchSetupState({ locale: "en", theme: "dark" }, "2026-08-16T21:00:00.000Z");
const communitiesDraft = updateFirstLaunchSetupState(draft, { purposeIds: ["communities"], currentStep: "ready" });
const reviewDesktop = reviewFirstLaunchStep(communitiesDraft, "desktop");
assert.equal(reviewDesktop.reviewAllSetup, true);
assert.equal(reviewDesktop.currentStep, "desktop");
assert.deepEqual([...communitiesDraft.skippedStepIds], []);

// CASE 18-25 completion
const beforeComplete = updateFirstLaunchSetupState(communitiesDraft, { purposeIds: ["friends"], theme: "light", locale: "tr" });
const afterComplete = completeFirstLaunchSetupState(beforeComplete, "2026-08-16T21:01:00.000Z");
assert.equal(afterComplete.completed, true);
assert.deepEqual([...afterComplete.purposeIds], []);
assert.equal(afterComplete.theme, "light");
assert.equal(afterComplete.locale, "tr");
assert.equal(PERSONALIZATION_RETENTION_AFTER_COMPLETION, "CLEARED");
assert.equal(firstLaunchCompletionPreservesProductSettings(beforeComplete, afterComplete), true);

const failedPersist = commitFirstLaunchCompletion({
  current: beforeComplete,
  next: afterComplete,
  alreadyComplete: false,
  persist: () => false,
});
assert.equal(failedPersist.ok, false);
assert.equal(failedPersist.value.completed, false);
assert.deepEqual([...failedPersist.value.purposeIds], ["friends"]);

const retried = commitFirstLaunchCompletion({
  current: failedPersist.value,
  next: completeFirstLaunchSetupState(failedPersist.value),
  alreadyComplete: false,
  persist: () => true,
});
assert.equal(retried.ok, true);
assert.equal(retried.value.completed, true);
assert.deepEqual([...retried.value.purposeIds], []);

const duplicate = commitFirstLaunchCompletion({
  current: afterComplete,
  next: completeFirstLaunchSetupState(afterComplete),
  alreadyComplete: true,
  persist: () => {
    throw new Error("duplicate completion must not persist again");
  },
});
assert.equal(duplicate.ok, true);

// CASE 26-30 cleanup
let cleaned = 0;
const unregister = registerFirstLaunchMediaCleanup(() => { cleaned += 1; });
runRegisteredFirstLaunchMediaCleanups();
runRegisteredFirstLaunchMediaCleanups();
assert.ok(cleaned >= 1);
unregister();

// CASE 31-35 gates
assert.equal(resolveFirstLaunchNextGate({ authenticated: false, legalAccepted: false, onboardingComplete: false }), "sign-in");
assert.equal(resolveFirstLaunchNextGate({ authenticated: true, legalAccepted: false, onboardingComplete: false }), "legal");
assert.equal(resolveFirstLaunchNextGate({ authenticated: true, legalAccepted: true, onboardingComplete: false }), "account-onboarding");
assert.equal(resolveFirstLaunchNextGate({ authenticated: true, legalAccepted: true, onboardingComplete: true }), "enter-picom");
assert.equal(canonical.primaryCtaKey, "ready.continueSignIn");
assert.equal(canonical.showProductActions, false);
const eligible = resolveFirstLaunchReadyState(baseInput({
  session: { authenticated: true, legalAccepted: true, onboardingComplete: true },
  privacy: { status: "ready", friendRequestKey: "privacy.friendRequests.everyone", directMessageKey: "privacy.dm.friends", profileKey: "privacy.profile.friends", presenceKey: "privacy.presence.show" },
  capabilities: { feed: true, messages: true, communities: true, discovery: true, createCommunity: true, addFriend: true },
}));
assert.equal(eligible.primaryCtaKey, "ready.enterPicom");
assert.equal(eligible.showProductActions, true);
assert.ok(eligible.productActions.length > 0);

const optionalBlocked = resolveFirstLaunchReadyState(baseInput({
  audio: { ...baseInput().audio, permission: "denied", setupStatus: "denied", microphoneTestPassed: false },
  camera: { ...baseInput().camera, permission: "denied", errorCode: "CAMERA_DENIED", passed: false },
  notifications: { capability: "browser-blocked", quietHoursEnabled: false, doNotDisturb: false },
}));
assert.equal(optionalBlocked.canComplete, true);
assert.equal(row(optionalBlocked, "microphone")?.status, "blocked");
assert.deepEqual(resolveFirstLaunchCompletionBlockers({ locale: "zz", theme: "neon" }).map((item) => item.code), ["locale", "theme"]);
assert.equal(resolveFirstLaunchReadyState(baseInput({ locale: "zz", theme: "neon" })).canComplete, false);

// CASE 36-41 product actions
for (const action of eligible.productActions) {
  const destination = toFirstProductActionDestination(action);
  assert.ok(["mentionFeed", "directMessages", "community", "discovery", "friends"].includes(destination.view));
  assert.equal(destination.conversationId, null);
  assert.equal(destination.communityId, null);
  assert.equal(destination.userId, null);
  if (action.id === "messages") assert.equal(destination.view, "directMessages");
  if (action.id === "add-friend") assert.equal(destination.friendsTab, "suggestions");
  if (action.id === "create-community") assert.equal(destination.openCreateCommunity, true);
}
assert.equal(sanitizeFirstProductActionId("https://evil.example/dm/123"), null);
assert.equal(sanitizeFirstProductActionId("directMessages?conversation=abc"), null);
assert.equal(sanitizeFirstProductActionId("feed"), "feed");

const hiddenActions = resolveFirstProductActions({
  capabilities: { authenticated: true, legalAccepted: true, onboardingComplete: true, feed: true, messages: true, communities: false, discovery: false, createCommunity: false, addFriend: false },
});
assert.deepEqual(hiddenActions.map((item) => item.id), ["feed", "messages"]);

// CASE 42-49 ranking
const rank = (purposeIds) => resolveFirstProductActions({
  purposeIds,
  capabilities: { authenticated: true, legalAccepted: true, onboardingComplete: true, feed: true, messages: true, communities: true, discovery: true, createCommunity: true, addFriend: true },
}).map((item) => item.id);
assert.equal(rank(["friends"])[0], "add-friend");
assert.ok(rank(["friends"]).includes("messages"));
assert.equal(rank(["communities"])[0], "communities");
assert.ok(rank(["communities"]).includes("create-community"));
assert.equal(rank(["gaming"])[0], "communities");
assert.ok(rank(["gaming"]).includes("messages"));
assert.equal(rank(["work"])[0], "messages");
assert.ok(rank(["work"]).includes("communities"));
assert.equal(rank(["creator"])[0], "communities");
assert.ok(rank(["creator"]).includes("create-community"));
assert.deepEqual(rank(["friends", "work"]), rank(["work", "friends"]));
assert.deepEqual(rank([]), ["feed", "messages", "communities", "create-community", "add-friend"]);
assert.equal(FIRST_PRODUCT_ACTION_MODE, "POST_AUTH_ONLY");

// CASE 50-58 handoff
clearFirstLaunchHandoffIntent();
assert.equal(setFirstLaunchHandoffIntent("https://picom.app/messages/abc"), null);
assert.equal(setFirstLaunchHandoffIntent({ conversationId: "dm-1" }), null);
assert.equal(setFirstLaunchHandoffIntent("messages", "user-a"), "messages");
assert.equal(peekFirstLaunchHandoffIntent(), "messages");
assert.equal(consumeFirstLaunchHandoffIntent("user-b"), null);
assert.equal(peekFirstLaunchHandoffIntent(), null);
setFirstLaunchHandoffIntent("feed", "user-a");
assert.equal(consumeFirstLaunchHandoffIntent("user-a"), "feed");
assert.equal(consumeFirstLaunchHandoffIntent("user-a"), null);
assert.equal(resolveFirstLaunchRouteDecision({
  firstLaunchRequired: false,
  authenticationRequired: false,
  legalRequired: false,
  accountOnboardingRequired: false,
  hasExplicitExternalIntent: true,
  hasHandoffIntent: true,
}), "explicit-external");
assert.equal(resolveFirstLaunchRouteDecision({
  firstLaunchRequired: false,
  authenticationRequired: true,
  legalRequired: false,
  accountOnboardingRequired: false,
  hasExplicitExternalIntent: false,
  hasHandoffIntent: true,
}), "gate");
assert.equal(resolveFirstLaunchRouteDecision({
  firstLaunchRequired: false,
  authenticationRequired: false,
  legalRequired: true,
  accountOnboardingRequired: false,
  hasExplicitExternalIntent: false,
  hasHandoffIntent: true,
}), "gate");
assert.equal(resolveFirstLaunchRouteDecision({
  firstLaunchRequired: false,
  authenticationRequired: false,
  legalRequired: false,
  accountOnboardingRequired: true,
  hasExplicitExternalIntent: false,
  hasHandoffIntent: true,
}), "gate");

const startup = resolveDesktopStartupDestination({
  firstLaunchRequired: false,
  authenticationRequired: false,
  accountOnboardingRequired: false,
  explicitDestination: null,
  startupDestination: "communities",
  lastSafeLocation: "feed",
});
assert.equal(startup, "communities");
assert.notEqual(startup, "messages");

const appSource = readFileSync("src/App.tsx", "utf8");
const setupSource = readFileSync("src/components/firstLaunch/FirstLaunchSetup.tsx", "utf8");
const readyUi = readFileSync("src/components/firstLaunch/FirstLaunchReady.tsx", "utf8");
const readyModel = readFileSync("src/services/firstLaunchReadyState.ts", "utf8");
const finishFnStart = appSource.indexOf("finishDesktopFirstLaunchSetup");
const firstLaunchGate = "if (!safeMode.active && !firstLaunchSetup.completed)";
const finishFnEnd = appSource.indexOf(firstLaunchGate);
assert.equal(appSource.slice(finishFnStart, finishFnEnd).includes("setActiveView("), false);
assert.ok(setupSource.includes("resolveFirstLaunchReadyState"));
assert.ok(setupSource.includes("readyState.primaryCtaKey"));
assert.ok(readyUi.includes("role=\"alert\""));
assert.ok(readyUi.includes("first-launch-ready-health-heading"));
assert.ok(!readyUi.includes("BLOCKED_ENVIRONMENT"));
assert.ok(!readyModel.includes("BLOCKED_ENVIRONMENT"));
assert.equal(READY_COMPLETION_BLOCKER_POLICY, "OPTIONAL_STEPS_NEVER_BLOCK");
assert.ok(appSource.includes("consumeFirstLaunchHandoffIntent"));
assert.ok(appSource.includes("hasExplicitDesktopRouteIntentRef.current"));
assert.ok(appSource.includes("clearFirstLaunchHandoffIntent()"));
const cleanupSource = readFileSync("src/services/firstLaunchMediaCleanup.ts", "utf8");
assert.ok(cleanupSource.includes("voiceDeviceService.stopTests()"));
assert.ok(cleanupSource.includes("meetingPreJoinService.stopDevicePreviews()"));
assert.ok(cleanupSource.includes("runRegisteredFirstLaunchMediaCleanups()"));

console.log("First-launch Ready runtime: summary, stale state, review, completion, cleanup, gates, and handoff cases passed.");
