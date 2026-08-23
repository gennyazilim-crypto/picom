import { getUiLanguageBcp47 } from "../services/localization/uiLanguages.ts";
import type { PluralForms, TranslationLocale } from "./types.ts";

const cache = new Map<string, Intl.PluralRules>();

function getPluralRules(locale: TranslationLocale): Intl.PluralRules {
  const bcp47 = getUiLanguageBcp47(locale);
  const cached = cache.get(bcp47);
  if (cached) return cached;
  const rules = new Intl.PluralRules(bcp47);
  cache.set(bcp47, rules);
  return rules;
}

/**
 * Resolves a plural-form map to the correct string for `count` in `locale`, using the
 * locale's real CLDR plural category (Russian/Polish have distinct one/few/many/other
 * categories that do not exist in English -- this is why plural forms are objects, not
 * a hardcoded singular/plural pair).
 */
export function resolvePluralForm(forms: PluralForms, count: number, locale: TranslationLocale): string {
  const category = getPluralRules(locale).select(count);
  return forms[category] ?? forms.other;
}

export function isPluralForms(value: unknown): value is PluralForms {
  return typeof value === "object" && value !== null && !Array.isArray(value) && "other" in value;
}
