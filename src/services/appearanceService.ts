import type { AccessibilitySettings, AppearanceSettings, ThemeMode, ThemePreference } from "./settingsService";
import { getAppearanceStudioRootAttributes, isInterfaceScale, type InterfaceScale } from "./appearanceStudioPreferences";
import { dateTimeService } from "./dateTimeService";
import { localizationService } from "./localizationService";
import { getUiLanguageMetadata, normalizeUiLanguage } from "./localization/uiLanguages";

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export const appearanceService = {
  resolveTheme(preference: ThemePreference): ThemeMode {
    return preference === "system" ? (systemPrefersDark() ? "dark" : "light") : preference;
  },

  applyDocumentPreferences(theme: ThemeMode, appearance: AppearanceSettings, accessibility: AccessibilitySettings): void {
    const root = document.documentElement;
    const language = normalizeUiLanguage(appearance.language);
    const meta = getUiLanguageMetadata(language);
    Object.assign(root.dataset, getAppearanceStudioRootAttributes(theme, appearance.themeMode, appearance.density, accessibility));
    root.dataset.language = language;
    root.dataset.dateStyle = appearance.dateStyle;
    root.dataset.timeFormat = appearance.timeFormat;
    root.lang = meta.bcp47;
    root.dir = meta.direction;
    localizationService.setLanguage(language);
    dateTimeService.configure({ language, dateStyle: appearance.dateStyle, timeFormat: appearance.timeFormat });
    // Best-effort: push the resolved locale into the Electron main process so the tray
    // menu, tooltip, and native notifications follow the same language without a restart.
    // Absent on the web build, so failures are non-fatal.
    try {
      void window.picomDesktop?.settings?.setLocale?.(language);
    } catch {
      /* renderer without the desktop bridge keeps renderer-only localization */
    }
  },

  async applyInterfaceScale(scale: InterfaceScale): Promise<
    | { ok: true; scale: InterfaceScale }
    | { ok: false; error: "UI_SCALE_UNAVAILABLE" | "UI_SCALE_APPLY_FAILED" }
  > {
    const setUiScale = typeof window !== "undefined" ? window.picomDesktop?.appearance?.setInterfaceScale : undefined;
    if (!setUiScale) return { ok: false, error: "UI_SCALE_UNAVAILABLE" };
    try {
      const result = await setUiScale(scale);
      return result.ok && isInterfaceScale(result.scale)
        ? { ok: true, scale: result.scale }
        : { ok: false, error: "UI_SCALE_APPLY_FAILED" };
    } catch {
      return { ok: false, error: "UI_SCALE_APPLY_FAILED" };
    }
  },

  subscribeToSystemTheme(listener: (theme: ThemeMode) => void): () => void {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => undefined;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => listener(media.matches ? "dark" : "light");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  },
};
