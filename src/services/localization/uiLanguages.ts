/**
 * Canonical PICOM UI locale registry (must stay aligned with Live Now catalog).
 * Single source for Desktop/Web language selection, RTL, and Intl locale tags.
 */

export const SUPPORTED_UI_LANGUAGES = [
  "en",
  "tr",
  "de",
  "fr",
  "es",
  "it",
  "pt",
  "ru",
  "ar",
  "ja",
] as const;

export type UiLanguage = (typeof SUPPORTED_UI_LANGUAGES)[number];

export const DEFAULT_UI_LANGUAGE: UiLanguage = "en";

export type UiLanguageMetadata = Readonly<{
  code: UiLanguage;
  /** Native endonym for the language selector */
  nativeLabel: string;
  /** BCP-47 tag for Intl formatters */
  bcp47: string;
  direction: "ltr" | "rtl";
}>;

const METADATA: Readonly<Record<UiLanguage, UiLanguageMetadata>> = {
  en: { code: "en", nativeLabel: "English", bcp47: "en-US", direction: "ltr" },
  tr: { code: "tr", nativeLabel: "Türkçe", bcp47: "tr-TR", direction: "ltr" },
  de: { code: "de", nativeLabel: "Deutsch", bcp47: "de-DE", direction: "ltr" },
  fr: { code: "fr", nativeLabel: "Français", bcp47: "fr-FR", direction: "ltr" },
  es: { code: "es", nativeLabel: "Español", bcp47: "es-ES", direction: "ltr" },
  it: { code: "it", nativeLabel: "Italiano", bcp47: "it-IT", direction: "ltr" },
  pt: { code: "pt", nativeLabel: "Português", bcp47: "pt-BR", direction: "ltr" },
  ru: { code: "ru", nativeLabel: "Русский", bcp47: "ru-RU", direction: "ltr" },
  ar: { code: "ar", nativeLabel: "العربية", bcp47: "ar", direction: "rtl" },
  ja: { code: "ja", nativeLabel: "日本語", bcp47: "ja-JP", direction: "ltr" },
};

export function isUiLanguage(value: unknown): value is UiLanguage {
  return typeof value === "string" && (SUPPORTED_UI_LANGUAGES as readonly string[]).includes(value);
}

/** Unknown / corrupt stored values normalize to the canonical default (never throw). */
export function normalizeUiLanguage(value: unknown): UiLanguage {
  if (isUiLanguage(value)) return value;
  if (typeof value === "string") {
    const base = value.trim().toLowerCase().split(/[-_]/)[0] ?? "";
    if (isUiLanguage(base)) return base;
  }
  return DEFAULT_UI_LANGUAGE;
}

export function getUiLanguageMetadata(language: UiLanguage): UiLanguageMetadata {
  return METADATA[normalizeUiLanguage(language)];
}

export function isRtlUiLanguage(language: UiLanguage): boolean {
  return getUiLanguageMetadata(language).direction === "rtl";
}

export function getUiLanguageBcp47(language: UiLanguage): string {
  return getUiLanguageMetadata(language).bcp47;
}

export function listUiLanguageMetadata(): readonly UiLanguageMetadata[] {
  return SUPPORTED_UI_LANGUAGES.map((code) => METADATA[code]);
}
