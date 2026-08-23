import { isPluralForms, resolvePluralForm } from "./pluralRules.ts";
import type { NamespaceResource, TranslationLocale, TranslationParams } from "./types.ts";

const INTERPOLATION_PATTERN = /\{\{(\w+)\}\}/g;

/** Replaces {{var}} placeholders; never emits raw HTML, unresolved params render as empty string. */
export function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(INTERPOLATION_PATTERN, (_match, name: string) => {
    const value = params[name];
    return value === undefined || value === null ? "" : String(value);
  });
}

/**
 * Resolves a single key's value out of a namespace resource: picks the plural form when
 * `params.count` is provided and the stored value is a plural map, then interpolates.
 * Returns null (never throws) when the key is missing or blank so callers can fall back.
 */
export function resolveTranslation(
  resource: NamespaceResource | undefined,
  key: string,
  locale: TranslationLocale,
  params?: TranslationParams,
): string | null {
  const raw = resource?.[key];
  if (raw === undefined) return null;

  if (isPluralForms(raw)) {
    const count = typeof params?.count === "number" ? params.count : Number(params?.count ?? NaN);
    if (Number.isNaN(count)) return null;
    const form = resolvePluralForm(raw, count, locale);
    return form.trim() ? interpolate(form, params) : null;
  }

  if (typeof raw !== "string" || !raw.trim()) return null;
  return interpolate(raw, params);
}
