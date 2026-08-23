import type { UiLanguage } from "../services/localization/uiLanguages.ts";

/**
 * One JSON namespace file must exist per locale under src/i18n/locales/<locale>/<namespace>.json.
 * Namespaces mirror the product surfaces requested for the 10-language rollout.
 */
export const I18N_NAMESPACES = [
  "common",
  "auth",
  "navigation",
  "feed",
  "messaging",
  "community",
  "voice",
  "live",
  "events",
  "profile",
  "settings",
  "notifications",
  "errors",
  "accessibility",
  "firstLaunch",
  "legal",
  "admin",
  "havooc",
] as const;

export type I18nNamespace = (typeof I18N_NAMESPACES)[number];

export type TranslationLocale = UiLanguage;

/** A plain string value, or an ICU-lite plural map keyed by Intl.PluralRules categories. */
export type PluralForms = Readonly<{
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}>;

export type TranslationValue = string | PluralForms;

export type NamespaceResource = Readonly<Record<string, TranslationValue>>;

export type TranslationParams = Readonly<Record<string, string | number>>;

/**
 * `count` is reserved: when present, a plural-form TranslationValue resolves via
 * Intl.PluralRules against this number before {{var}} interpolation runs.
 */
export type TFunction = (key: string, params?: TranslationParams) => string;
