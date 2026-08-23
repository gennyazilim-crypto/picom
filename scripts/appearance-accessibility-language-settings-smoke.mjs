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
  if (missing.length) throw new Error(`${label}: missing ${missing.join(", ")}`);
};

requireAll(settings, ["ThemePreference", "AppearanceSettings", "getAppearanceStudioDefaults", 'language: "en"', 'dateStyle: "system"', 'timeFormat: "system"', "fromVersion: 7", "toVersion: 8", "fromVersion: 13", "toVersion: 14"], "appearance schema");
requireAll(appearance, ["resolveTheme", "subscribeToSystemTheme", "applyDocumentPreferences", "dateTimeService.configure", "root.lang", "applyInterfaceScale"], "appearance runtime");
requireAll(localization, ["activeLanguage", "setLanguage(language", "normalizeUiLanguage"], "runtime locale bridge");
requireAll(modal, ["theme.system", "appearanceSettings.language", "appearanceSettings.density", "appearanceSettings.dateStyle", "appearanceSettings.timeFormat", "updateAppearance", "textSize", "interfaceScale"], "Appearance Settings UI");
requireAll(app, ["appearanceService.resolveTheme", "appearanceService.subscribeToSystemTheme", "appearanceService.applyDocumentPreferences", "appearanceSettings={appearanceSettings}", "updateDesktopInterfaceScale"], "App integration");
requireAll(bootstrap, ["picom-settings", "prefers-color-scheme: dark", "themePreference", "dataset.reducedMotion", "dataset.highContrast", "dataset.textSize", "dataset.interfaceScale", "root.lang"], "pre-paint bootstrap");
requireAll(dateTime, ["configure(next", "Intl.DateTimeFormat", "timeFormat", "dateStyle", "hour12"], "date/time preference");
requireAll(styles, ['data-density="compact"', 'data-reduced-motion="true"', 'data-high-contrast="true"', 'data-text-size="large"', 'data-text-size="extra-large"'], "root appearance CSS");
if (index.indexOf("/theme-bootstrap.js") > index.indexOf("/src/main.tsx")) throw new Error("Appearance bootstrap must execute before React.");

console.log("System theme, no-flash bootstrap, accessibility, density, semantic text size, UI scale, and date/time preference contracts passed.");
