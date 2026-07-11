import type { AccessibilitySettings, AppearanceSettings, ThemeMode, ThemePreference } from "./settingsService";
import { dateTimeService } from "./dateTimeService";
import { localizationService } from "./localizationService";

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export const appearanceService = {
  resolveTheme(preference: ThemePreference): ThemeMode {
    return preference === "system" ? (systemPrefersDark() ? "dark" : "light") : preference;
  },

  applyDocumentPreferences(theme: ThemeMode, appearance: AppearanceSettings, accessibility: AccessibilitySettings): void {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.themePreference = appearance.themeMode;
    root.dataset.language = appearance.language;
    root.dataset.density = appearance.density;
    root.dataset.dateStyle = appearance.dateStyle;
    root.dataset.timeFormat = appearance.timeFormat;
    root.dataset.highContrast = accessibility.highContrast ? "true" : "false";
    root.dataset.reducedMotion = accessibility.reducedMotion ? "true" : "false";
    root.dataset.largerText = accessibility.largerText ? "true" : "false";
    root.dataset.focusRingStrong = accessibility.focusRingStrong ? "true" : "false";
    root.lang = appearance.language;
    localizationService.setLanguage(appearance.language);
    dateTimeService.configure({ language: appearance.language, dateStyle: appearance.dateStyle, timeFormat: appearance.timeFormat });
  },

  subscribeToSystemTheme(listener: (theme: ThemeMode) => void): () => void {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => undefined;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => listener(media.matches ? "dark" : "light");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  },
};
