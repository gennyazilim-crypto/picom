import assert from "node:assert/strict";

const appearanceStudio = await import("../src/services/appearanceStudioPreferences.ts");
const uiScalePolicy = await import("../electron/uiScalePolicy.cjs");

const {
  INTERFACE_SCALE_FACTORS,
  TEXT_SIZE_OPTIONS,
  getAppearanceStudioDefaults,
  getAppearanceStudioRootAttributes,
  normalizeAccessibilitySettings,
} = appearanceStudio;

assert.deepEqual(TEXT_SIZE_OPTIONS, ["default", "large", "extra-large"]);
assert.deepEqual(INTERFACE_SCALE_FACTORS, [0.9, 1, 1.1, 1.25]);
assert.equal(normalizeAccessibilitySettings({ largerText: true }).textSize, "large");
assert.equal(normalizeAccessibilitySettings({ largerText: false }).textSize, "default");
assert.equal(normalizeAccessibilitySettings({ textSize: "extra-large" }).textSize, "extra-large");
assert.equal(normalizeAccessibilitySettings({ interfaceScale: 5 }).interfaceScale, 1);
assert.equal(normalizeAccessibilitySettings({ interfaceScale: 0.9 }).interfaceScale, 0.9);

const defaults = getAppearanceStudioDefaults();
assert.deepEqual(defaults.appearance, { themeMode: "system", density: "comfortable" });
assert.deepEqual(defaults.accessibility, {
  textSize: "default",
  interfaceScale: 1,
  highContrast: false,
  reducedMotion: false,
  focusRingStrong: false,
});

const attributes = getAppearanceStudioRootAttributes("dark", "dark", "compact", {
  textSize: "extra-large", interfaceScale: 1.25, highContrast: true, reducedMotion: true, focusRingStrong: true,
});
assert.deepEqual(attributes, {
  theme: "dark",
  themePreference: "dark",
  density: "compact",
  highContrast: "true",
  reducedMotion: "true",
  textSize: "extra-large",
  interfaceScale: "1.25",
  focusRingStrong: "true",
});

assert.equal(uiScalePolicy.isAllowedInterfaceScale(0.9), true);
assert.equal(uiScalePolicy.isAllowedInterfaceScale(1.25), true);
for (const rejected of [0, -1, Number.NaN, 5, 1.2, "1.1"]) {
  assert.equal(uiScalePolicy.isAllowedInterfaceScale(rejected), false, `must reject ${String(rejected)}`);
}
assert.equal(uiScalePolicy.normalizeInterfaceScale(5), 1);

console.log("Appearance Studio settings, root attributes, migration, and UI-scale policy runtime tests passed.");
