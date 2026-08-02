import type { SettingsSection, UiLanguage } from "./settingsService";

export type LocalizationKey =
  | "settings.title" | "settings.close" | "appearance.title" | "appearance.description"
  | "theme.light" | "theme.lightHint" | "theme.dark" | "theme.darkHint" | "theme.system" | "theme.systemHint"
  | "accessibility.title" | "accessibility.description" | "accessibility.highContrast" | "accessibility.highContrastHint"
  | "accessibility.reducedMotion" | "accessibility.reducedMotionHint" | "accessibility.largerText" | "accessibility.largerTextHint"
  | "accessibility.focusRing" | "accessibility.focusRingHint" | "appearance.language" | "appearance.languageHint"
  | "appearance.density" | "appearance.densityHint" | "appearance.dateStyle" | "appearance.dateStyleHint"
  | "appearance.timeFormat" | "appearance.timeFormatHint"
  | "feed.loading" | "feed.loadingMore" | "feed.empty.title" | "feed.empty.body" | "feed.empty.unread"
  | "feed.offline" | "feed.error.title" | "feed.error.body" | "feed.sessionExpired" | "feed.accessDenied"
  | "feed.retry" | "feed.loadMore" | "feed.end" | "feed.newActivities" | "feed.stale"
  | "feed.replies" | "feed.reactions" | "feed.saved" | "feed.read" | "feed.inaccessible"
  | "feed.live.bandLabel" | "feed.live.eyebrow" | "feed.live.title" | "feed.live.subtitle"
  | "feed.live.emptyTitle" | "feed.live.emptyBody" | "feed.live.count" | "feed.live.scrollLeft" | "feed.live.scrollRight"
  | "feed.live.openAria" | "feed.live.communityFallback"
  | "feed.live.category.game" | "feed.live.category.chat" | "feed.live.category.education"
  | "feed.live.category.watchTogether" | "feed.live.category.other"
  | "feed.companion.friends" | "feed.companion.events" | "feed.companion.voice";

type Vars = Readonly<Record<string, string>>;

const en: Record<LocalizationKey, string> = {
  "settings.title": "Settings", "settings.close": "Close settings", "appearance.title": "Appearance", "appearance.description": "Device-local visual, language, date, and accessibility preferences.",
  "theme.light": "Light Theme", "theme.lightHint": "Soft shell with clean white surfaces.", "theme.dark": "Dark Theme", "theme.darkHint": "Charcoal shell with separated surfaces.", "theme.system": "System Theme", "theme.systemHint": "Follow the Windows, Linux, or macOS appearance.",
  "accessibility.title": "Accessibility display options", "accessibility.description": "Local desktop preferences for contrast, motion, text scale, and focus visibility.",
  "accessibility.highContrast": "High contrast mode", "accessibility.highContrastHint": "Strengthens text, borders, and focus rings using Picom design tokens.",
  "accessibility.reducedMotion": "Reduced motion", "accessibility.reducedMotionHint": "Reduces non-essential transitions, animations, and smooth scrolling.",
  "accessibility.largerText": "Larger text", "accessibility.largerTextHint": "Increases text scale without changing the desktop layout.",
  "accessibility.focusRing": "Strong focus ring", "accessibility.focusRingHint": "Makes keyboard focus indicators more visible.",
  "appearance.language": "Language", "appearance.languageHint": "Applies to Picom-controlled interface copy; user content is never translated.",
  "appearance.density": "Desktop density", "appearance.densityHint": "Choose comfortable or compact spacing without changing the four-column layout.",
  "appearance.dateStyle": "Date style", "appearance.dateStyleHint": "Choose system, numeric, or descriptive dates.",
  "appearance.timeFormat": "Time format", "appearance.timeFormatHint": "Choose system, 12-hour, or 24-hour time.",
  "feed.loading": "Loading activity…",
  "feed.loadingMore": "Loading more activity…",
  "feed.empty.title": "No activity yet",
  "feed.empty.body": "Mentions and replies from communities you can access will appear here.",
  "feed.empty.unread": "No unread activity",
  "feed.offline": "You appear to be offline. Reconnect to refresh activity.",
  "feed.error.title": "Could not load activity",
  "feed.error.body": "Picom could not reach the Feed. Try again in a moment.",
  "feed.sessionExpired": "Your session expired. Sign in again to continue.",
  "feed.accessDenied": "You do not have access to this activity.",
  "feed.retry": "Retry",
  "feed.loadMore": "Load more",
  "feed.end": "You are caught up",
  "feed.newActivities": "New activities",
  "feed.stale": "Showing cached activity while Picom reconnects.",
  "feed.replies": "Replies",
  "feed.reactions": "Reactions",
  "feed.saved": "Saved",
  "feed.read": "Read",
  "feed.inaccessible": "This content is no longer available.",
  "feed.live.bandLabel": "Live Now preview",
  "feed.live.eyebrow": "LIVE NOW",
  "feed.live.title": "Live Now",
  "feed.live.subtitle": "Active community broadcasts you can join",
  "feed.live.emptyTitle": "No live broadcasts right now",
  "feed.live.emptyBody": "When accessible streams start, they will appear here.",
  "feed.live.count": "{{count}} live",
  "feed.live.scrollLeft": "Scroll Live Now left",
  "feed.live.scrollRight": "Scroll Live Now right",
  "feed.live.openAria": "Open {{name}} live: {{title}}",
  "feed.live.communityFallback": "Community",
  "feed.live.category.game": "Game",
  "feed.live.category.chat": "Chat",
  "feed.live.category.education": "Education",
  "feed.live.category.watchTogether": "Watch together",
  "feed.live.category.other": "Live",
  "feed.companion.friends": "Friends",
  "feed.companion.events": "Upcoming events",
  "feed.companion.voice": "Connected Voice",
};

const tr: Record<LocalizationKey, string> = {
  "settings.title": "Ayarlar", "settings.close": "Ayarları kapat", "appearance.title": "Görünüm", "appearance.description": "Bu cihaza özel görünüm, dil, tarih ve erişilebilirlik tercihleri.",
  "theme.light": "Açık Tema", "theme.lightHint": "Temiz beyaz yüzeylere sahip yumuşak görünüm.", "theme.dark": "Koyu Tema", "theme.darkHint": "Birbirinden ayrılmış kömür tonlu yüzeyler.", "theme.system": "Sistem Teması", "theme.systemHint": "Windows, Linux veya macOS görünümünü takip eder.",
  "accessibility.title": "Erişilebilirlik görünüm seçenekleri", "accessibility.description": "Kontrast, hareket, metin ölçeği ve odak görünürlüğü için yerel tercihler.",
  "accessibility.highContrast": "Yüksek kontrast", "accessibility.highContrastHint": "Picom tasarım belirteçleriyle metinleri, kenarlıkları ve odak halkalarını güçlendirir.",
  "accessibility.reducedMotion": "Azaltılmış hareket", "accessibility.reducedMotionHint": "Gerekli olmayan geçişleri, animasyonları ve yumuşak kaydırmayı azaltır.",
  "accessibility.largerText": "Büyük metin", "accessibility.largerTextHint": "Mobil düzene geçmeden masaüstü metin ölçeğini artırır.",
  "accessibility.focusRing": "Güçlü odak halkası", "accessibility.focusRingHint": "Klavye odak göstergelerini daha görünür yapar.",
  "appearance.language": "Dil", "appearance.languageHint": "Picom arayüz metinlerine uygulanır; kullanıcı içeriği asla çevrilmez.",
  "appearance.density": "Masaüstü yoğunluğu", "appearance.densityHint": "Dört sütunlu düzeni değiştirmeden rahat veya kompakt aralık seçin.",
  "appearance.dateStyle": "Tarih stili", "appearance.dateStyleHint": "Sistem, sayısal veya açıklamalı tarih biçimini seçin.",
  "appearance.timeFormat": "Saat biçimi", "appearance.timeFormatHint": "Sistem, 12 saat veya 24 saat biçimini seçin.",
  "feed.loading": "Aktivite yükleniyor…",
  "feed.loadingMore": "Daha fazla aktivite yükleniyor…",
  "feed.empty.title": "Henüz aktivite yok",
  "feed.empty.body": "Erişebildiğin topluluklardan bahsetmeler ve yanıtlar burada görünür.",
  "feed.empty.unread": "Okunmamış aktivite yok",
  "feed.offline": "Çevrimdışı görünüyorsun. Aktiviteyi yenilemek için yeniden bağlan.",
  "feed.error.title": "Aktivite yüklenemedi",
  "feed.error.body": "Picom Feed’e ulaşamadı. Biraz sonra yeniden dene.",
  "feed.sessionExpired": "Oturumun sona erdi. Devam etmek için yeniden giriş yap.",
  "feed.accessDenied": "Bu aktiviteye erişimin yok.",
  "feed.retry": "Yeniden dene",
  "feed.loadMore": "Daha fazla yükle",
  "feed.end": "Hepsi bu kadar",
  "feed.newActivities": "Yeni aktiviteler",
  "feed.stale": "Picom yeniden bağlanırken önbellekteki aktivite gösteriliyor.",
  "feed.replies": "Yanıtlar",
  "feed.reactions": "Tepkiler",
  "feed.saved": "Kaydedildi",
  "feed.read": "Okundu",
  "feed.inaccessible": "Bu içerik artık kullanılamıyor.",
  "feed.live.bandLabel": "Live Now önizlemesi",
  "feed.live.eyebrow": "LIVE NOW",
  "feed.live.title": "Live Now",
  "feed.live.subtitle": "Katılabileceğin aktif topluluk yayınları",
  "feed.live.emptyTitle": "Şu anda canlı yayın yok",
  "feed.live.emptyBody": "Erişilebilir yayınlar başladığında burada görünür.",
  "feed.live.count": "{{count}} canlı",
  "feed.live.scrollLeft": "Live Now’u sola kaydır",
  "feed.live.scrollRight": "Live Now’u sağa kaydır",
  "feed.live.openAria": "{{name}} yayınını aç: {{title}}",
  "feed.live.communityFallback": "Topluluk",
  "feed.live.category.game": "Oyun",
  "feed.live.category.chat": "Sohbet",
  "feed.live.category.education": "Eğitim",
  "feed.live.category.watchTogether": "Birlikte izle",
  "feed.live.category.other": "Canlı",
  "feed.companion.friends": "Arkadaşlar",
  "feed.companion.events": "Yaklaşan etkinlikler",
  "feed.companion.voice": "Bağlı ses",
};

const sectionTr: Record<SettingsSection, string> = {
  "Account": "Hesap",
  "Profile": "Profil",
  "Privacy & Safety": "Gizlilik ve Güvenlik",
  "Appearance": "Görünüm",
  "Notifications": "Bildirimler",
  "Voice & Video": "Ses ve Video",
  "Companion": "Companion",
  "Keyboard Shortcuts": "Klavye Kısayolları",
  "Windows & Startup": "Windows ve Başlangıç",
  "Storage": "Depolama",
  "Update": "Güncelleme",
  "Diagnostics": "Tanılama",
  "Admin Operations": "Yönetim",
  "Legal": "Yasal",
  "Advanced": "Gelişmiş",
};

let activeLanguage: UiLanguage = "en";

function applyVars(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

export const localizationService = {
  setLanguage(language: UiLanguage): void { activeLanguage = language; },
  getLanguage(): UiLanguage { return activeLanguage; },
  translate(key: LocalizationKey, varsOrLanguage?: Vars | UiLanguage, maybeLanguage?: UiLanguage): string {
    const vars = typeof varsOrLanguage === "object" ? varsOrLanguage : undefined;
    const language = typeof varsOrLanguage === "string" ? varsOrLanguage : (maybeLanguage ?? activeLanguage);
    return applyVars((language === "tr" ? tr : en)[key], vars);
  },
  translateSettingsSection(section: SettingsSection, language = activeLanguage): string { return language === "tr" ? sectionTr[section] : section; },
  keys(): readonly LocalizationKey[] { return Object.keys(en) as LocalizationKey[]; },
};
