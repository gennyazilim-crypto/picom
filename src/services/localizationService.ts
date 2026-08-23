import type { UiLanguage } from "./settingsService";
import { normalizeUiLanguage } from "./localization/uiLanguages";

/**
 * Lightweight non-React mirror of the active UI locale, for modules that read/format
 * outside a component tree (translateLiveNow, translatePublisherProgram, Intl-based
 * date formatting call sites). The authoritative source is appearanceSettings.language
 * in settingsService; appearanceService pushes updates here on every change.
 *
 * String catalog lookups live in src/i18n (useTranslation) for React components, or in
 * the dedicated per-feature catalogs (settingsI18n, liveNowCatalog, publisherProgramCatalog)
 * for the surfaces that predate the unified runtime.
 */
let activeLanguage: UiLanguage = "en";

export const localizationService = {
  setLanguage(language: UiLanguage): void {
    activeLanguage = normalizeUiLanguage(language);
  },
  getLanguage(): UiLanguage {
    return activeLanguage;
  },
};
