import {
  getFallbackNamespaceResource,
  getNamespaceResource,
  resolveTranslation,
} from "../../i18n";
import type { TranslationParams } from "../../i18n";
import { localizationService } from "../localizationService";

/**
 * Non-React resolver for the `voice` namespace.
 *
 * Voice / meeting / screen-share services build user-facing result messages outside a
 * component tree (LiveKit disconnect reasons, capture failures, validation errors), and
 * several of those messages are surfaced verbatim by callers that only receive the
 * already-resolved string. Those call sites therefore need real text, not a key, so this
 * helper resolves the key against the active UI locale (mirrored by localizationService)
 * with the English catalog as the fallback -- exactly the behaviour `useTranslation`
 * gives components.
 */
export function voiceText(key: string, params?: TranslationParams): string {
  const locale = localizationService.getLanguage();
  const localized = resolveTranslation(getNamespaceResource(locale, "voice"), key, locale, params);
  if (localized !== null) return localized;
  const fallback = resolveTranslation(getFallbackNamespaceResource("voice"), key, "en", params);
  return fallback === null ? key : fallback;
}
