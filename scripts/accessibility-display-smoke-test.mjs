import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assertIncludes(text, expected, label) {
  if (!text.includes(expected)) {
    throw new Error(`${label} missing expected content: ${expected}`);
  }
}

const settingsService = read("src/services/settingsService.ts");
const app = read("src/App.tsx");
const appearance = read("src/services/appearanceService.ts");
const appearanceStudioPreferences = read("src/services/appearanceStudioPreferences.ts");
const settingsModal = read("src/components/SettingsModal.tsx");
const localization = read("src/services/localizationService.ts");
const settingsI18n = read("src/services/settings/settingsI18n.ts");
const styles = read("src/styles.css");
const doc = read("docs/high-contrast-reduced-motion.md");

for (const expected of [
  "AccessibilitySettings",
  "highContrast",
  "reducedMotion",
  "textSize",
  "interfaceScale",
  "focusRingStrong",
  "updateAccessibilitySettings",
]) {
  assertIncludes(settingsService, expected, "settingsService");
}

for (const expected of [
  "getAppearanceStudioRootAttributes",
  "highContrast",
  "reducedMotion",
  "textSize",
  "focusRingStrong",
]) {
  assertIncludes(app + appearance + appearanceStudioPreferences, expected, "App root accessibility dataset");
}

for (const expected of [
  "High contrast mode",
  "Reduced motion",
  "Text size",
  "Strong focus ring",
]) {
  assertIncludes(settingsModal + localization + settingsI18n, expected, "SettingsModal accessibility controls");
}

for (const expected of [
  "data-high-contrast",
  "data-reduced-motion",
  "data-text-size",
  "data-focus-ring-strong",
  "animation-delay: 0ms !important",
  "transition-delay: 0ms !important",
  "@media (prefers-reduced-motion: reduce)",
  "transition-duration: 1ms !important",
]) {
  assertIncludes(styles, expected, "accessibility CSS");
}

assertIncludes(doc, "Settings > Appearance", "accessibility docs");
assertIncludes(doc, "No mobile UI", "accessibility docs");
if (doc.includes("Larger text placeholder") || doc.includes("Strong focus ring placeholder")) {
  throw new Error("Accessibility docs still describe finalized controls as placeholders.");
}

console.log("High contrast and reduced motion smoke test passed.");
