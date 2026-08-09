import { SUPPORTED_UI_LANGUAGES, normalizeUiLanguage, type UiLanguage } from "./uiLanguages.ts";

type Catalog = Record<string, string>;

const en: Catalog = {
  "media.recording": "Recording",
  "media.recordingStarting": "Recording starting",
  "media.recordingActive": "Recording",
  "media.recordingFailed": "Recording failed",
  "media.replay": "Replay",
  "media.replays": "Replays",
  "media.archive": "Archive",
  "media.processing": "Processing",
  "media.ready": "Ready",
  "media.published": "Published",
  "media.private": "Private",
  "media.unlisted": "Unlisted",
  "media.createClip": "Create clip",
  "media.clipStart": "Clip start (ms)",
  "media.clipEnd": "Clip end (ms)",
  "media.clipDuration": "Clip duration",
  "media.thumbnail": "Thumbnail",
  "media.playbackError": "Playback failed.",
  "media.mediaUnavailable": "Media unavailable.",
  "media.recordingUnavailable": "Recording is currently unavailable.",
  "media.deleteReplay": "Delete replay",
  "media.archiveReplay": "Archive replay",
  "media.publishReplay": "Publish replay",
  "media.takedown": "Takedown",
};

const tr: Catalog = {
  ...en,
  "media.recording": "Kayıt",
  "media.recordingActive": "Kayıt alınıyor",
  "media.recordingFailed": "Kayıt başarısız",
  "media.replay": "Tekrar",
  "media.replays": "Tekrarlar",
  "media.archive": "Arşiv",
  "media.processing": "İşleniyor",
  "media.createClip": "Klip oluştur",
  "media.mediaUnavailable": "Medya kullanılamıyor.",
  "media.recordingUnavailable": "Kayıt şu anda kullanılamıyor.",
};

const de: Catalog = { ...en, "media.recording": "Aufnahme", "media.replays": "Wiederholungen" };
const fr: Catalog = { ...en, "media.recording": "Enregistrement", "media.replays": "Replays" };
const es: Catalog = { ...en, "media.recording": "Grabación", "media.replays": "Repeticiones" };
const it: Catalog = { ...en, "media.recording": "Registrazione", "media.replays": "Replay" };
const pt: Catalog = { ...en, "media.recording": "Gravação", "media.replays": "Replays" };
const ru: Catalog = { ...en, "media.recording": "Запись", "media.replays": "Повторы" };
const ar: Catalog = { ...en, "media.recording": "تسجيل", "media.replays": "الإعادات", "media.archive": "الأرشيف" };
const ja: Catalog = { ...en, "media.recording": "録画", "media.replays": "リプレイ" };

const CATALOGS: Record<UiLanguage, Catalog> = { en, tr, de, fr, es, it, pt, ru, ar, ja };

export function translatePublisherMedia(key: string, locale: string): string {
  const lang = normalizeUiLanguage(locale);
  const catalog = CATALOGS[lang] ?? en;
  return catalog[key] ?? en[key] ?? key;
}

export function publisherMediaCatalogLocales(): readonly UiLanguage[] {
  return SUPPORTED_UI_LANGUAGES;
}
