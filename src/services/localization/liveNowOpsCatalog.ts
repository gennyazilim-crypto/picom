import { SUPPORTED_UI_LANGUAGES, normalizeUiLanguage, type UiLanguage } from "./uiLanguages.ts";

type Catalog = Record<string, string>;

const en: Catalog = {
  "ops.goLiveUnavailable": "Go Live is temporarily unavailable.",
  "ops.liveNowUnavailable": "Live Now is temporarily unavailable.",
  "ops.liveKitUnavailable": "Live connection is temporarily unavailable.",
  "ops.chatUnavailable": "Live chat is temporarily unavailable.",
  "ops.analyticsUnavailable": "Publisher analytics is temporarily unavailable.",
  "ops.recordingBlocked": "Recording is not available on this environment.",
  "ops.monetizationUnavailable": "Monetization is currently unavailable.",
  "ops.creatorStudioUnavailable": "Creator Studio is temporarily unavailable.",
  "ops.moduleDegraded": "This module is temporarily degraded. Please try again later.",
  "ops.dependencyUnavailable": "A required service dependency is unavailable.",
};

const tr: Catalog = {
  ...en,
  "ops.goLiveUnavailable": "Canlı yayın geçici olarak kullanılamıyor.",
  "ops.liveNowUnavailable": "Live Now geçici olarak kullanılamıyor.",
  "ops.liveKitUnavailable": "Canlı bağlantı geçici olarak kullanılamıyor.",
  "ops.chatUnavailable": "Canlı sohbet geçici olarak kullanılamıyor.",
  "ops.analyticsUnavailable": "Yayıncı analitikleri geçici olarak kullanılamıyor.",
  "ops.recordingBlocked": "Kayıt bu ortamda kullanılamıyor.",
  "ops.monetizationUnavailable": "Para kazanma şu anda kullanılamıyor.",
  "ops.creatorStudioUnavailable": "Creator Studio geçici olarak kullanılamıyor.",
  "ops.moduleDegraded": "Bu modül geçici olarak bozuldu. Lütfen daha sonra tekrar deneyin.",
  "ops.dependencyUnavailable": "Gerekli bir servis bağımlılığı kullanılamıyor.",
};

const de: Catalog = {
  ...en,
  "ops.goLiveUnavailable": "Go Live ist vorübergehend nicht verfügbar.",
  "ops.liveNowUnavailable": "Live Now ist vorübergehend nicht verfügbar.",
  "ops.moduleDegraded": "Dieses Modul ist vorübergehend eingeschränkt.",
};

const fr: Catalog = {
  ...en,
  "ops.goLiveUnavailable": "Go Live est temporairement indisponible.",
  "ops.liveNowUnavailable": "Live Now est temporairement indisponible.",
  "ops.moduleDegraded": "Ce module est temporairement dégradé.",
};

const es: Catalog = {
  ...en,
  "ops.goLiveUnavailable": "Go Live no está disponible temporalmente.",
  "ops.liveNowUnavailable": "Live Now no está disponible temporalmente.",
  "ops.moduleDegraded": "Este módulo está temporalmente degradado.",
};

const it: Catalog = {
  ...en,
  "ops.goLiveUnavailable": "Go Live non è temporaneamente disponibile.",
  "ops.liveNowUnavailable": "Live Now non è temporaneamente disponibile.",
  "ops.moduleDegraded": "Questo modulo è temporaneamente degradato.",
};

const pt: Catalog = {
  ...en,
  "ops.goLiveUnavailable": "Go Live está temporariamente indisponível.",
  "ops.liveNowUnavailable": "Live Now está temporariamente indisponível.",
  "ops.moduleDegraded": "Este módulo está temporariamente degradado.",
};

const ru: Catalog = {
  ...en,
  "ops.goLiveUnavailable": "Go Live временно недоступен.",
  "ops.liveNowUnavailable": "Live Now временно недоступен.",
  "ops.moduleDegraded": "Этот модуль временно работает с ограничениями.",
};

const ar: Catalog = {
  ...en,
  "ops.goLiveUnavailable": "البث المباشر غير متاح مؤقتًا.",
  "ops.liveNowUnavailable": "Live Now غير متاح مؤقتًا.",
  "ops.moduleDegraded": "هذه الوحدة متدهورة مؤقتًا.",
};

const ja: Catalog = {
  ...en,
  "ops.goLiveUnavailable": "Go Live は一時的に利用できません。",
  "ops.liveNowUnavailable": "Live Now は一時的に利用できません。",
  "ops.moduleDegraded": "このモジュールは一時的に低下しています。",
};

const CATALOGS: Record<UiLanguage, Catalog> = { en, tr, de, fr, es, it, pt, ru, ar, ja };

export function translateLiveNowOps(key: string, locale: string): string {
  const lang = normalizeUiLanguage(locale);
  const catalog = CATALOGS[lang] ?? en;
  return catalog[key] ?? en[key] ?? key;
}

export function liveNowOpsCatalogLocales(): readonly UiLanguage[] {
  return SUPPORTED_UI_LANGUAGES;
}
