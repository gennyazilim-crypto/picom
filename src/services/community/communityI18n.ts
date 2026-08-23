import {
  getFallbackNamespaceResource,
  getNamespaceResource,
  resolveTranslation,
} from "../../i18n";
import type { TranslationParams } from "../../i18n";
import { localizationService } from "../localizationService";

/**
 * Non-React accessor for the `community` namespace.
 *
 * Service, catalog, and validation modules cannot call `useTranslation` (no hook context),
 * so they resolve copy through this helper: it reads the active locale from
 * `localizationService` -- the documented non-React mirror of `appearanceSettings.language`
 * -- and falls back to the English catalog when a key is missing in that locale.
 *
 * React components must keep using `useTranslation("community")` so they re-render on a
 * language change; this helper is only for the modules that render nothing themselves.
 */
export function communityText(key: string, params?: TranslationParams): string {
  const locale = localizationService.getLanguage();
  const resolved = resolveTranslation(getNamespaceResource(locale, "community"), key, locale, params);
  if (resolved !== null) return resolved;

  const fallback = resolveTranslation(getFallbackNamespaceResource("community"), key, "en", params);
  return fallback ?? key;
}
