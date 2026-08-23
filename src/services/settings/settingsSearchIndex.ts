import type { SettingsSection, UiLanguage } from "../settingsService";
import { getUiLanguageBcp47, normalizeUiLanguage } from "../localization/uiLanguages";
import {
  translateSettings,
  translateSettingsSection,
  type SettingsI18nKey,
} from "./settingsI18n";

export type SettingsSearchHit = Readonly<{
  id: string;
  section: SettingsSection;
  titleEn: string;
  titleTr: string;
  descriptionEn: string;
  descriptionTr: string;
  /**
   * Display keys are resolved from the complete 10-language Settings catalog. The
   * English/Turkish fields remain search aliases for people who type a familiar
   * term while using another app language; they are never used as the display
   * fallback for a supported locale.
   */
  titleKey: SettingsI18nKey;
  descriptionKey: SettingsI18nKey;
  keywords: readonly string[];
  focusSelector?: string;
}>;

/** Bilingual searchable settings catalog (section + setting + aliases). */
export const SETTINGS_SEARCH_INDEX: readonly SettingsSearchHit[] = [
  {
    id: "account-summary",
    section: "Account",
    titleEn: "My account",
    titleTr: "Hesabım",
    descriptionEn: "Avatar, username, email, plan, and Account Center links",
    descriptionTr: "Avatar, kullanıcı adı, e-posta, plan ve Hesap Merkezi bağlantıları",
    titleKey: "nav.section.account",
    descriptionKey: "account.summaryDescription",
    keywords: ["account", "hesap", "email", "e-posta", "profile", "profil", "steam", "epic", "google"],
    focusSelector: "#settings-account-summary",
  },
  {
    id: "account-connections",
    section: "Account",
    titleEn: "Connected accounts",
    titleTr: "Bağlı hesaplar",
    descriptionEn: "Steam, Epic, and Google connection summary",
    descriptionTr: "Steam, Epic ve Google bağlantı özeti",
    titleKey: "account.connections",
    descriptionKey: "account.summaryDescription",
    keywords: ["connections", "bağlantı", "provider", "steam", "epic", "google", "oauth"],
    focusSelector: "#settings-account-providers",
  },
  {
    id: "profile-display",
    section: "Profile",
    titleEn: "Display name and avatar",
    titleTr: "Görünen ad ve avatar",
    descriptionEn: "Edit display name, bio, avatar, and banner",
    descriptionTr: "Görünen ad, bio, avatar ve banner düzenle",
    titleKey: "nav.section.profile",
    descriptionKey: "profile.description",
    keywords: ["avatar", "banner", "bio", "display name", "görünen ad", "username", "kullanıcı adı"],
    focusSelector: "#settings-profile-identity",
  },
  {
    id: "appearance-theme",
    section: "Appearance",
    titleEn: "Theme",
    titleTr: "Tema",
    descriptionEn: "System, light, or dark theme",
    descriptionTr: "Sistem, açık veya koyu tema",
    titleKey: "appearance.title",
    descriptionKey: "appearance.description",
    keywords: ["theme", "tema", "dark", "koyu", "light", "açık", "system", "sistem"],
    focusSelector: ".appearance-theme-panel",
  },
  {
    id: "appearance-density",
    section: "Appearance",
    titleEn: "Density",
    titleTr: "Yoğunluk",
    descriptionEn: "Comfortable or compact desktop density",
    descriptionTr: "Rahat veya kompakt masaüstü yoğunluğu",
    titleKey: "appearance.density",
    descriptionKey: "appearance.densityHint",
    keywords: ["density", "yoğunluk", "compact", "kompakt", "comfortable", "rahat"],
  },
  {
    id: "appearance-language",
    section: "Language & Region",
    titleEn: "Language",
    titleTr: "Dil",
    descriptionEn: "Application language English or Turkish",
    descriptionTr: "Uygulama dili İngilizce veya Türkçe",
    titleKey: "language.title",
    descriptionKey: "language.description",
    keywords: ["language", "dil", "locale", "english", "türkçe", "turkish", "deutsch", "français", "español", "italiano", "português", "nederlands", "polski", "русский", "i18n"],
  },
  {
    id: "accessibility",
    section: "Appearance",
    titleEn: "Accessibility",
    titleTr: "Erişilebilirlik",
    descriptionEn: "High contrast, reduced motion, larger text, focus ring",
    descriptionTr: "Yüksek kontrast, azaltılmış hareket, büyük yazı, odak halkası",
    titleKey: "accessibility.title",
    descriptionKey: "accessibility.description",
    keywords: ["accessibility", "erişilebilirlik", "contrast", "kontrast", "motion", "hareket", "a11y", "wcag"],
    focusSelector: "[aria-label='Accessibility display options']",
  },
  {
    id: "notifications-master",
    section: "Notifications",
    titleEn: "Notifications",
    titleTr: "Bildirimler",
    descriptionEn: "Desktop notifications, sound, quiet hours, DND",
    descriptionTr: "Masaüstü bildirimleri, ses, sessiz saatler, rahatsız etme",
    titleKey: "nav.section.notifications",
    descriptionKey: "notifications.description",
    keywords: ["notification", "bildirim", "sound", "ses", "dnd", "quiet", "sessiz", "badge"],
  },
  {
    id: "voice-microphone",
    section: "Voice & Video",
    titleEn: "Microphone",
    titleTr: "Mikrofon",
    descriptionEn: "Input device, level meter, noise suppression, push-to-talk",
    descriptionTr: "Giriş cihazı, seviye ölçer, gürültü engelleme, bas konuş",
    titleKey: "voice.microphoneTitle",
    descriptionKey: "voice.section.description",
    keywords: ["microphone", "mikrofon", "mic", "input", "giriş", "noise", "gürültü", "agc", "echo", "yankı"],
    focusSelector: "#voice-microphone",
  },
  {
    id: "voice-speaker",
    section: "Voice & Video",
    titleEn: "Speaker output",
    titleTr: "Hoparlör çıkışı",
    descriptionEn: "Output device and test tone",
    descriptionTr: "Çıkış cihazı ve test sesi",
    titleKey: "voice.outputTitle",
    descriptionKey: "voice.outputRoutingNote",
    keywords: ["speaker", "hoparlör", "output", "çıkış", "deafen", "volume", "ses"],
    focusSelector: "#voice-output",
  },
  {
    id: "voice-camera",
    section: "Voice & Video",
    titleEn: "Camera",
    titleTr: "Kamera",
    descriptionEn: "Camera device and live preview lifecycle",
    descriptionTr: "Kamera cihazı ve canlı önizleme yaşam döngüsü",
    titleKey: "voice.cameraTitle",
    descriptionKey: "voice.cameraPolicyHint",
    keywords: ["camera", "kamera", "video", "preview", "önizleme", "webcam"],
  },
  {
    id: "privacy-dm",
    section: "Privacy & Safety",
    titleEn: "Direct messages",
    titleTr: "Direkt mesajlar",
    descriptionEn: "Who can DM you and friend request controls",
    descriptionTr: "Kimler DM atabilir ve arkadaşlık isteği kontrolleri",
    titleKey: "nav.section.privacySafety",
    descriptionKey: "privacy.description",
    keywords: ["dm", "message", "mesaj", "friend", "arkadaş", "privacy", "gizlilik", "block", "engel"],
    focusSelector: "#privacy-reach",
  },
  {
    id: "shortcuts",
    section: "Keyboard Shortcuts",
    titleEn: "Keyboard shortcuts",
    titleTr: "Klavye kısayolları",
    descriptionEn: "Mute, deafen, search, and channel shortcuts",
    descriptionTr: "Sessiz, sağır, arama ve kanal kısayolları",
    titleKey: "nav.section.keyboardShortcuts",
    descriptionKey: "nav.section.keyboardShortcuts",
    keywords: ["shortcut", "kısayol", "keyboard", "klavye", "hotkey", "mute", "deafen"],
  },
  {
    id: "windows-startup",
    section: "Windows & Startup",
    titleEn: "Launch on startup",
    titleTr: "Açılışta başlat",
    descriptionEn: "Windows login item, close to tray, window memory",
    descriptionTr: "Windows açılış öğesi, tepsiye küçült, pencere hafızası",
    titleKey: "nav.section.windowsStartup",
    descriptionKey: "windows.description",
    keywords: ["startup", "başlangıç", "tray", "tepsi", "windows", "launch", "autostart"],
    focusSelector: "#settings-windows-startup",
  },
  {
    id: "storage-cache",
    section: "Storage",
    titleEn: "Cache and storage",
    titleTr: "Önbellek ve depolama",
    descriptionEn: "Clear cache, open logs, reset local settings",
    descriptionTr: "Önbelleği temizle, günlükleri aç, yerel ayarları sıfırla",
    titleKey: "storage.summary",
    descriptionKey: "storage.description",
    keywords: ["cache", "önbellek", "storage", "depolama", "logs", "günlük", "download", "indir"],
    focusSelector: "#settings-storage-cache",
  },
  {
    id: "advanced",
    section: "Advanced",
    titleEn: "Advanced",
    titleTr: "Gelişmiş",
    descriptionEn: "Diagnostics and safe advanced desktop controls",
    descriptionTr: "Tanılama ve güvenli gelişmiş masaüstü kontrolleri",
    titleKey: "nav.section.advanced",
    descriptionKey: "advanced.description",
    keywords: ["advanced", "gelişmiş", "diagnostics", "tanılama", "webrtc"],
  },
  {
    id: "update",
    section: "Update",
    titleEn: "Updates",
    titleTr: "Güncellemeler",
    descriptionEn: "Check for desktop updates and release channel",
    descriptionTr: "Masaüstü güncellemesi ve yayın kanalı",
    titleKey: "update.sectionTitle",
    descriptionKey: "update.description",
    keywords: ["update", "güncelleme", "version", "sürüm", "release"],
  },
  {
    id: "legal",
    section: "Legal",
    titleEn: "Legal",
    titleTr: "Yasal",
    descriptionEn: "Terms, privacy, licenses",
    descriptionTr: "Şartlar, gizlilik, lisanslar",
    titleKey: "nav.section.legal",
    descriptionKey: "legal.description",
    keywords: ["legal", "yasal", "terms", "privacy", "gizlilik", "license", "lisans"],
  },
] as const;

function normalizeQuery(query: string, language: UiLanguage): string {
  return query.trim().toLocaleLowerCase(getUiLanguageBcp47(normalizeUiLanguage(language)));
}

export function searchSettingsCatalog(query: string, language: UiLanguage = "en"): SettingsSearchHit[] {
  const locale = normalizeUiLanguage(language);
  const q = normalizeQuery(query, locale);
  if (!q) return [];
  const tokens = q.split(/\s+/).filter(Boolean);
  return SETTINGS_SEARCH_INDEX.filter((hit) => {
    const haystack = [
      settingsSearchResultLabel(hit, locale),
      settingsSearchResultDescription(hit, locale),
      translateSettingsSection(hit.section, locale),
      hit.titleEn,
      hit.titleTr,
      hit.descriptionEn,
      hit.descriptionTr,
      hit.section,
      ...hit.keywords,
    ]
      .join(" ")
      .toLocaleLowerCase(getUiLanguageBcp47(locale));
    return tokens.every((token) => haystack.includes(token));
  }).map((hit) => hit);
}

export function settingsSearchResultLabel(hit: SettingsSearchHit, language: UiLanguage): string {
  return translateSettings(hit.titleKey, normalizeUiLanguage(language));
}

export function settingsSearchResultDescription(hit: SettingsSearchHit, language: UiLanguage): string {
  return translateSettings(hit.descriptionKey, normalizeUiLanguage(language));
}
