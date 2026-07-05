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
const settingsModal = read("src/components/SettingsModal.tsx");
const styles = read("src/styles.css");
const doc = read("docs/high-contrast-reduced-motion.md");

for (const expected of [
  "AccessibilitySettings",
  "highContrast",
  "reducedMotion",
  "largerText",
  "focusRingStrong",
  "updateAccessibilitySettings",
]) {
  assertIncludes(settingsService, expected, "settingsService");
}

for (const expected of [
  "dataset.highContrast",
  "dataset.reducedMotion",
  "dataset.largerText",
  "dataset.focusRingStrong",
]) {
  assertIncludes(app, expected, "App root accessibility dataset");
}

for (const expected of [
  "High contrast mode",
  "Reduced motion",
  "Larger text placeholder",
  "Strong focus ring placeholder",
]) {
  assertIncludes(settingsModal, expected, "SettingsModal accessibility controls");
}

for (const expected of [
  "data-high-contrast",
  "data-reduced-motion",
  "data-larger-text",
  "data-focus-ring-strong",
  "transition-duration: 1ms !important",
]) {
  assertIncludes(styles, expected, "accessibility CSS");
}

assertIncludes(doc, "Settings > Appearance", "accessibility docs");
assertIncludes(doc, "No mobile UI", "accessibility docs");

console.log("High contrast and reduced motion smoke test passed.");
