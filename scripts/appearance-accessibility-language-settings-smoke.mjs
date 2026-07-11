import { readFileSync } from "node:fs";
const read = (path) => readFileSync(path, "utf8");
const settings = read("src/services/settingsService.ts");
const appearance = read("src/services/appearanceService.ts");
const localization = read("src/services/localizationService.ts");
const modal = read("src/components/SettingsModal.tsx");
const app = read("src/App.tsx");
const bootstrap = read("public/theme-bootstrap.js");
const dateTime = read("src/services/dateTimeService.ts");
const styles = read("src/styles.css");
const index = read("index.html");

const requireAll = (source, values, label) => {
  const missing = values.filter((value) => !source.includes(value));
  if (missing.length) throw new Error(label + ": missing " + missing.join(", "));
};
requireAll(settings, ["ThemePreference", "AppearanceSettings", 'themeMode: "system"', 'language: "en"', 'density: "comfortable"', 'dateStyle: "system"', 'timeFormat: "system"', "fromVersion: 7", "toVersion: 8"], "appearance schema");
requireAll(appearance, ["resolveTheme", "subscribeToSystemTheme", "applyDocumentPreferences", "dateTimeService.configure", "root.lang"], "appearance runtime");
requireAll(localization, ["const en:", "const tr:", "translateSettingsSection", "Görünüm"], "typed TR/EN catalog");
requireAll(modal, ["theme.system", "appearanceSettings.language", "appearanceSettings.density", "appearanceSettings.dateStyle", "appearanceSettings.timeFormat", "updateAppearance"], "Appearance Settings UI");
requireAll(app, ["appearanceService.resolveTheme", "appearanceService.subscribeToSystemTheme", "appearanceService.applyDocumentPreferences", "appearanceSettings={appearanceSettings}"], "App integration");
requireAll(bootstrap, ["picom-settings", "prefers-color-scheme: dark", "themePreference", "dataset.reducedMotion", "dataset.highContrast", "root.lang"], "pre-paint bootstrap");
requireAll(dateTime, ["configure(next", '"tr-TR"', '"en-US"', "timeFormat", "dateStyle", "hour12"], "date/time preference");
requireAll(styles, ['data-density="compact"', 'data-reduced-motion="true"', 'data-high-contrast="true"', 'data-larger-text="true"'], "root appearance CSS");
if (index.indexOf("/theme-bootstrap.js") > index.indexOf("/src/main.tsx")) throw new Error("Appearance bootstrap must execute before React.");
console.log("System theme, no-flash bootstrap, accessibility, density, TR/EN, and date/time preference contracts passed.");
