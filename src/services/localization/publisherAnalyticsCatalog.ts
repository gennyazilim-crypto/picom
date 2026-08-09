import { SUPPORTED_UI_LANGUAGES, normalizeUiLanguage, type UiLanguage } from "./uiLanguages.ts";

type Catalog = Record<string, string>;

const en: Catalog = {
  "analytics.title": "Analytics",
  "analytics.overview": "Overview",
  "analytics.uniqueViewers": "Unique viewers",
  "analytics.viewerSessions": "Viewer sessions",
  "analytics.peakConcurrent": "Peak concurrent",
  "analytics.currentConcurrent": "Current viewers",
  "analytics.watchTime": "Watch time",
  "analytics.averageWatchTime": "Average watch time",
  "analytics.retention": "Retention",
  "analytics.followersGained": "Followers gained",
  "analytics.notificationConversion": "Notification joins",
  "analytics.chatEngagement": "Chat engagement",
  "analytics.streamPerformance": "Stream performance",
  "analytics.audience": "Audience",
  "analytics.sources": "Sources",
  "analytics.platforms": "Platforms",
  "analytics.locales": "Locales",
  "analytics.streamHealth": "Stream health",
  "analytics.reconnects": "Reconnects",
  "analytics.noAnalyticsData": "No analytics data for this range yet.",
  "analytics.analyticsProcessing": "Analytics are still processing for live streams.",
  "analytics.range7": "7 days",
  "analytics.range30": "30 days",
  "analytics.range90": "90 days",
  "analytics.streamCount": "Streams",
  "analytics.recentStreams": "Recent streams",
  "analytics.finalized": "Finalized",
  "analytics.live": "Live metrics",
  "analytics.disabled": "Publisher analytics is currently unavailable.",
  "analytics.reactions": "Reactions",
  "analytics.chatMessages": "Chat messages",
  "analytics.moderationActions": "Moderation actions",
};

const tr: Catalog = {
  ...en,
  "analytics.title": "Analitik",
  "analytics.overview": "Genel bakış",
  "analytics.uniqueViewers": "Benzersiz izleyiciler",
  "analytics.viewerSessions": "İzleyici oturumları",
  "analytics.peakConcurrent": "Zirve eşzamanlı",
  "analytics.currentConcurrent": "Anlık izleyiciler",
  "analytics.watchTime": "İzleme süresi",
  "analytics.averageWatchTime": "Ortalama izleme süresi",
  "analytics.followersGained": "Kazanılan takipçiler",
  "analytics.notificationConversion": "Bildirimden katılım",
  "analytics.chatEngagement": "Sohbet etkileşimi",
  "analytics.noAnalyticsData": "Bu aralık için henüz analitik verisi yok.",
  "analytics.analyticsProcessing": "Canlı yayınlar için analitik hâlâ işleniyor.",
  "analytics.disabled": "Yayıncı analitikleri şu anda kullanılamıyor.",
  "analytics.recentStreams": "Son yayınlar",
};

const de: Catalog = { ...en, "analytics.title": "Analysen", "analytics.uniqueViewers": "Eindeutige Zuschauer" };
const fr: Catalog = { ...en, "analytics.title": "Analytique", "analytics.uniqueViewers": "Spectateurs uniques" };
const es: Catalog = { ...en, "analytics.title": "Analítica", "analytics.uniqueViewers": "Espectadores únicos" };
const it: Catalog = { ...en, "analytics.title": "Analitiche", "analytics.uniqueViewers": "Spettatori unici" };
const pt: Catalog = { ...en, "analytics.title": "Analítica", "analytics.uniqueViewers": "Espectadores únicos" };
const ru: Catalog = { ...en, "analytics.title": "Аналитика", "analytics.uniqueViewers": "Уникальные зрители" };
const ar: Catalog = { ...en, "analytics.title": "التحليلات", "analytics.uniqueViewers": "مشاهدون فريدون", "analytics.noAnalyticsData": "لا توجد بيانات تحليلات لهذا النطاق بعد." };
const ja: Catalog = { ...en, "analytics.title": "アナリティクス", "analytics.uniqueViewers": "ユニーク視聴者" };

const CATALOGS: Record<UiLanguage, Catalog> = { en, tr, de, fr, es, it, pt, ru, ar, ja };

export type PublisherAnalyticsI18nKey = keyof typeof en;

export function translatePublisherAnalytics(
  key: string,
  locale: string,
  params?: Record<string, string | number>,
): string {
  const lang = normalizeUiLanguage(locale);
  const catalog = CATALOGS[lang] ?? en;
  const template = catalog[key] ?? en[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_match, name: string) => String(params[name] ?? ""));
}

export function assertPublisherAnalyticsLocaleParity(): void {
  const keys = Object.keys(en).sort();
  for (const locale of SUPPORTED_UI_LANGUAGES) {
    const catalogKeys = Object.keys(CATALOGS[locale]).sort();
    if (catalogKeys.join("\0") !== keys.join("\0")) {
      throw new Error(`publisher analytics catalog parity failed for ${locale}`);
    }
  }
}
