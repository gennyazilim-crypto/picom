import { getFallbackNamespaceResource, getNamespaceResource, resolveTranslation } from "../i18n";
import type { I18nNamespace, TranslationParams } from "../i18n";
import { localizationService } from "./localizationService";

/**
 * Non-React translation access for the Feed/Audio/Profile service layer.
 *
 * Service modules cannot call the `useTranslation` hook, but they still return
 * user-facing text (validation messages, unavailable-backend notices). They resolve
 * those strings through the same `src/i18n/locales/<locale>/{feed,profile}.json`
 * catalogs the components use, against the active UI locale mirrored by
 * `localizationService` (kept in sync by `appearanceService`).
 */
function translate(namespace: I18nNamespace, key: string, params?: TranslationParams): string {
  const locale = localizationService.getLanguage();
  const resolved = resolveTranslation(getNamespaceResource(locale, namespace), key, locale, params);
  if (resolved !== null) return resolved;
  return resolveTranslation(getFallbackNamespaceResource(namespace), key, "en", params) ?? key;
}

/** Resolves a key from the `feed` namespace against the active UI locale. */
export function translateFeed(key: string, params?: TranslationParams): string {
  return translate("feed", key, params);
}

/** Resolves a key from the `profile` namespace against the active UI locale. */
export function translateProfile(key: string, params?: TranslationParams): string {
  return translate("profile", key, params);
}
