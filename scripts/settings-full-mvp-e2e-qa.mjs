import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const settings = read("src/components/SettingsModal.tsx");
const settingsService = read("src/services/settingsService.ts");
const app = read("src/App.tsx");
const packageJson = JSON.parse(read("package.json"));

const sections = [
  "Account",
  "Profile",
  "Privacy & Safety",
  "Appearance",
  "Notifications",
  "Voice & Video",
  "Keyboard Shortcuts",
  "Advanced",
  "Diagnostics",
];

for (const section of sections) {
  assert.ok(settings.includes(`\"${section}\"`), `Settings is missing the ${section} section`);
}

for (const integratedArea of [
  'aria-label="Accessibility display options"',
  'aria-label="Language date and desktop density"',
]) {
  assert.ok(settings.includes(integratedArea), `Appearance is missing integrated controls: ${integratedArea}`);
}

const staleVisibleCopy = [
  "Coming soon",
  "Future read receipts",
  "Future menu entries",
  "Future production deployments",
  "Prepared for future tray startup behavior",
  "Supabase re-auth unlock is coming later",
  "This section is not enabled in the current desktop release",
];

for (const copy of staleVisibleCopy) {
  assert.ok(!settings.includes(copy), `Settings still exposes stale placeholder copy: ${copy}`);
}

for (const marker of [
  "profileService.updateCurrentProfile",
  "settingsService.updateAccessibilitySettings",
  "settingsService.updateAppearanceSettings",
  "<VoiceDeviceSelection />",
  "<KeyboardShortcutsSection />",
  "cacheManagementService.clearAllNonEssentialCache()",
  'setActive("Diagnostics")',
  "await onLogout()",
]) {
  assert.ok(settings.includes(marker), `Settings is missing a real service integration: ${marker}`);
}

assert.ok(!settings.includes("supabase.from("), "Settings UI must not access Supabase tables directly");
assert.ok(settingsService.includes("const currentSchemaVersion = 9"), "Settings schema version 9 is required");
assert.ok(settingsService.includes("backupInvalidSettings"), "Corrupt local settings must use the bounded backup path");
assert.ok(settingsService.includes('storage.setItem("picom:safe-mode:forced", "true")'), "Corrupt settings must activate the Safe Mode recovery signal");
assert.ok(settingsService.includes('storage.setItem("picom:safe-mode:reason", "corrupted_local_settings")'), "Corrupt settings must use the canonical recovery reason");
assert.ok(app.includes("settingsService.hydrateAccountSettings"), "Account settings must hydrate during startup");
assert.ok(app.includes("appearanceService.applyDocumentPreferences"), "Appearance and accessibility preferences must affect the document");

const requiredGates = [
  "settings:completeness:test",
  "settings:architecture:smoke",
  "settings:account-security:smoke",
  "settings:profile-privacy:smoke",
  "settings:appearance-accessibility:smoke",
  "notifications:preferences:smoke",
  "voice:settings:smoke",
  "keyboard:shortcuts:final:test",
  "settings:advanced-diagnostics:smoke",
  "local-data:migration:smoke",
  "visual:regression:contract",
  "e2e:coverage:contract",
];

for (const script of requiredGates) {
  assert.equal(typeof packageJson.scripts?.[script], "string", `Missing Settings QA gate: ${script}`);
}

console.log("Settings Full MVP end-to-end QA contract: PASS");
