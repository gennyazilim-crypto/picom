import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const settings = readFileSync("src/services/settingsService.ts", "utf8");
const state = readFileSync("src/services/firstLaunchSetupState.ts", "utf8");
const registry = readFileSync("src/services/firstLaunchSetupSteps.ts", "utf8");
const setup = readFileSync("src/components/firstLaunch/FirstLaunchSetup.tsx", "utf8");
const appearanceStudio = readFileSync("src/components/firstLaunch/AppearanceStudio.tsx", "utf8");
const firstLaunchAudio = readFileSync("src/components/firstLaunch/FirstLaunchAudioSetup.tsx", "utf8");
const styles = readFileSync("src/styles.css", "utf8");
const app = readFileSync("src/App.tsx", "utf8");
const settingsModal = readFileSync("src/components/SettingsModal.tsx", "utf8");
const locales = ["en", "tr", "de", "fr", "es", "it", "pt", "nl", "pl", "ru"];

assert.ok(state.includes("FIRST_LAUNCH_SETUP_VERSION") && state.includes("normalizeFirstLaunchSetupState"), "Versioned first-launch state is missing");
assert.ok(settings.includes("fromVersion: 11") && settings.includes("toVersion: 12"), "Original additive first-launch migration is missing");
assert.ok(settings.includes("fromVersion: 12") && settings.includes("toVersion: 13"), "Eight-step additive first-launch migration is missing");
assert.ok(settings.includes("getFirstLaunchSetupState") && settings.includes("updateFirstLaunchSetupState") && settings.includes("skipFirstLaunchSetupStep") && settings.includes("completeFirstLaunchSetup"), "Canonical first-launch state API is missing");
assert.ok(settings.includes("firstLaunchSetup: \"local-device\""), "First-launch draft must remain device-local");
assert.ok(!settings.includes("firstLaunchSetup.user") && !settings.includes("firstLaunchSetup.user_id"), "First-launch draft must not be user keyed");

const stableStepIds = ["welcome", "personalize", "appearance", "audio-video", "desktop", "notifications", "privacy", "ready"];
for (const id of stableStepIds) assert.ok(registry.includes(`\"${id}\"`), `Stable first-launch step ID ${id} is missing`);
assert.ok(registry.includes("FIRST_LAUNCH_STEP_REGISTRY") && registry.includes("renderKey") && registry.includes("canSkip") && registry.includes("descriptionKey"), "Canonical step metadata registry is incomplete");
assert.ok(registry.includes('permissions: "notifications"'), "Legacy permissions resume mapping is missing");

assert.ok(setup.includes('useTranslation("firstLaunch")'), "First-launch UI must use the global i18n provider");
assert.ok(setup.includes("listUiLanguageMetadata"), "First-launch UI must use the canonical locale registry");
assert.ok(appearanceStudio.includes('"system", "light", "dark"'), "All theme preferences must be selectable");
assert.ok(setup.includes("aria-current={isCurrent ? \"step\" : undefined}") && setup.includes('role="progressbar"') && appearanceStudio.includes('role="radiogroup"') && appearanceStudio.includes("aria-checked") && appearanceStudio.includes("changeThemeFromKeyboard"), "Navigation, progress, and theme controls need accessible semantics");
assert.ok(setup.includes("headingRef.current?.focus()") && setup.includes("onSkip(current.id"), "Step focus recovery or persisted optional skip is missing");
assert.ok(!/Coming soon|Placeholder|TODO|microphone ready|camera ready|notifications enabled|setStepIndex/.test(setup), "First-launch shell must not present fake device success or disconnected index navigation");
assert.ok(!/firstLaunchCopy|navigator\.language|localStorage|getUserMedia|desktopCapturer|requestPermission|startScreenShare|voiceService/.test(setup), "First-launch UI must not own persistence, locale detection, or native/media permission prompts");
assert.equal(existsSync("src/components/firstLaunch/firstLaunchCopy.ts"), false, "Legacy hardcoded first-launch copy must not remain");
assert.ok(styles.includes("Adaptive eight-step first-launch navigation shell") && styles.includes("@media (max-width: 780px)") && styles.includes("first-launch-compact-header"), "Responsive first-launch shell styles are missing");
assert.ok(styles.includes("data-reduced-motion=\"true\"") && styles.includes("prefers-reduced-motion"), "First-launch transitions must respect reduced motion");
assert.ok(appearanceStudio.includes("AppearanceStudioPreview") && appearanceStudio.includes("onInterfaceScaleChange") && appearanceStudio.includes("onResetAppearance"), "First-launch Appearance Studio must use the canonical persisted runtime controls");
assert.ok(setup.includes("<FirstLaunchAudioSetup />") && setup.includes("microphoneTestPassed"), "First-launch audio setup and truthful Ready summary are missing");
assert.ok(setup.includes("<FirstLaunchPrivacySetup") && setup.includes("firstLaunchPrivacyReadyKeys"), "First-launch privacy setup and truthful Ready summary are missing");
assert.ok(existsSync("src/services/firstLaunchPersonalization.ts"), "Adaptive personalization engine is missing");
const personalization = readFileSync("src/services/firstLaunchPersonalization.ts", "utf8");
assert.ok(personalization.includes("resolveFirstLaunchPlan") && personalization.includes("getNextIncludedStep") && personalization.includes("getPreviousIncludedStep"), "Adaptive plan resolver helpers are missing");
assert.ok(personalization.includes("PERSONALIZATION RETENTION AFTER COMPLETION") && personalization.includes("CLEARED"), "Completion retention policy must be declared CLEARED");
assert.ok(state.includes("purposeIds") && state.includes("reviewAllSetup") && state.includes("FIRST_LAUNCH_SETUP_VERSION = 3"), "Versioned purpose and review-all draft fields are missing");
const readyState = readFileSync("src/services/firstLaunchReadyState.ts", "utf8");
assert.ok(setup.includes("FirstLaunchPersonalize") && (setup.includes("ready.notIncluded") || readyState.includes("ready.notIncluded")) && !setup.includes("friends-communication"), "Personalize must use canonical purpose IDs and distinguish omitted steps");
assert.ok(existsSync("src/components/firstLaunch/FirstLaunchPersonalize.tsx"), "Personalize purpose cards are missing");
assert.ok(existsSync("src/services/privacy/firstLaunchPrivacyReady.ts"), "Ready privacy summary helper is missing");
const privacySetup = readFileSync("src/components/firstLaunch/FirstLaunchPrivacySetup.tsx", "utf8");
const privacyService = readFileSync("src/services/privacy/accountPrivacySetupService.ts", "utf8");
assert.ok(privacyService.includes("INTERACTIVE_ONLY_WHEN_AUTHENTICATED") && privacyService.includes("get_own_profile_privacy_v3") && privacyService.includes("update_direct_message_privacy"), "Account privacy adapter must reuse canonical RPCs");
assert.ok(!privacyService.includes("localStorage") && !privacySetup.includes("lastSeen") && !privacySetup.includes("discoverability"), "First-launch privacy must not invent last-seen, discoverability, or device storage");
assert.ok(privacySetup.includes('role="radiogroup"') && privacySetup.includes("aria-busy") && privacySetup.includes('role="alert"'), "Privacy setup needs accessible loading, radio, and error semantics");
assert.ok(privacySetup.includes("privacy.reviewAfterSignIn") || setup.includes("privacy.reviewAfterSignIn") || privacySetup.includes("deferredTitle"), "Anonymous first-run must defer account privacy");
assert.ok(firstLaunchAudio.includes("voiceDeviceService.refresh(false)") && firstLaunchAudio.includes("voiceDeviceService.stopTests()") && firstLaunchAudio.includes('role="meter"'), "First-launch audio must reuse the device service with cleanup and accessible metering");
assert.ok(!/getUserMedia|LiveKit|video:|fetch\(|localStorage|MediaRecorder/.test(firstLaunchAudio), "First-launch audio UI must not directly capture, upload, store, record, or join calls");
assert.ok(!styles.includes(".titlebar-actions > :not(.window-controls)"), "Narrow first-launch layout must retain window controls");

const english = JSON.parse(readFileSync("src/i18n/locales/en/firstLaunch.json", "utf8"));
const keys = Object.keys(english).sort();
for (const locale of locales) {
  const path = `src/i18n/locales/${locale}/firstLaunch.json`;
  assert.ok(existsSync(path), `Missing first-launch catalog for ${locale}`);
  const catalog = JSON.parse(readFileSync(path, "utf8"));
  assert.deepEqual(Object.keys(catalog).sort(), keys, `First-launch catalog keys drifted for ${locale}`);
  for (const [key, value] of Object.entries(catalog)) assert.ok(typeof value === "string" && value.trim(), `Blank first-launch translation ${locale}.${key}`);
}

const firstLaunchGuardIndex = app.indexOf("if (!safeMode.active && !firstLaunchSetup.completed)");
const authReadyGuardIndex = app.indexOf("if (!authReady)");
assert.ok(firstLaunchGuardIndex >= 0 && authReadyGuardIndex > firstLaunchGuardIndex, "Device first-launch gate must precede auth loading and signed-out rendering");
assert.ok(app.includes("<I18nProvider locale={normalizeUiLanguage(appearanceSettings.language)}>") && app.includes("updateDesktopFirstLaunchSetup"), "First-launch locale must drive the app i18n provider");
assert.ok(settingsModal.includes("import.meta.env.DEV") && settingsModal.includes("Reset first-launch setup") && settingsModal.includes("settingsService.resetFirstLaunchSetup()"), "Development-only first-launch reset control is missing");
assert.ok(settings.includes("backupInvalidSettings(raw, storage)") && settings.includes("return cloneSettings(defaults)"), "Corrupted settings must retain a safe-default recovery path");

console.log("First-launch eight-step shell, device policy, resumable state, i18n catalog, and auth-ordering smoke passed.");
