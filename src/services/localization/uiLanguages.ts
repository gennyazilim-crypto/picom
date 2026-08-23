/**
 * Canonical PICOM UI locale registry (must stay aligned with the Electron main-process
 * locale catalog in electron/mainLocale.cts).
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
  "nl",
  "pl",
  "ru",
] as const;

export type UiLanguage = (typeof SUPPORTED_UI_LANGUAGES)[number];

export const DEFAULT_UI_LANGUAGE: UiLanguage = "en";

export type UiLanguageMetadata = Readonly<{
  code: UiLanguage;
  /** Native endonym for the language selector */
  nativeLabel: string;
  /** English name of the language, shown alongside the native endonym */
  englishLabel: string;
  /** BCP-47 tag for Intl formatters, document.lang, Electron locale, and notifications */
  bcp47: string;
  direction: "ltr" | "rtl";
}>;

const METADATA: Readonly<Record<UiLanguage, UiLanguageMetadata>> = {
  en: { code: "en", nativeLabel: "English", englishLabel: "English", bcp47: "en-US", direction: "ltr" },
  tr: { code: "tr", nativeLabel: "Türkçe", englishLabel: "Turkish", bcp47: "tr-TR", direction: "ltr" },
  de: { code: "de", nativeLabel: "Deutsch", englishLabel: "German", bcp47: "de-DE", direction: "ltr" },
  fr: { code: "fr", nativeLabel: "Français", englishLabel: "French", bcp47: "fr-FR", direction: "ltr" },
  es: { code: "es", nativeLabel: "Español", englishLabel: "Spanish", bcp47: "es-ES", direction: "ltr" },
  it: { code: "it", nativeLabel: "Italiano", englishLabel: "Italian", bcp47: "it-IT", direction: "ltr" },
  pt: { code: "pt", nativeLabel: "Português", englishLabel: "Portuguese (Brazil)", bcp47: "pt-BR", direction: "ltr" },
  nl: { code: "nl", nativeLabel: "Nederlands", englishLabel: "Dutch", bcp47: "nl-NL", direction: "ltr" },
  pl: { code: "pl", nativeLabel: "Polski", englishLabel: "Polish", bcp47: "pl-PL", direction: "ltr" },
  ru: { code: "ru", nativeLabel: "Русский", englishLabel: "Russian", bcp47: "ru-RU", direction: "ltr" },
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

/**
 * Resolves a raw OS/browser locale string (e.g. navigator.language, Electron's app.getLocale())
 * to a supported UiLanguage, falling back to English when unsupported. Used by languageMode
 * "system" on every startup, and for first-launch default selection.
 */
export function resolveSystemUiLanguage(rawLocale: string | undefined | null): UiLanguage {
  if (!rawLocale) return DEFAULT_UI_LANGUAGE;
  return normalizeUiLanguage(rawLocale);
}
