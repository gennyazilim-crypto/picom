import type { SettingsSection, UiLanguage } from "../settingsService";
import { normalizeUiLanguage } from "../localization/uiLanguages";

export type SettingsSearchHit = Readonly<{
  id: string;
  section: SettingsSection;
  titleEn: string;
  titleTr: string;
  descriptionEn: string;
  descriptionTr: string;
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
    keywords: ["density", "yoğunluk", "compact", "kompakt", "comfortable", "rahat"],
  },
  {
    id: "appearance-language",
    section: "Appearance",
    titleEn: "Language",
    titleTr: "Dil",
    descriptionEn: "Application language English or Turkish",
    descriptionTr: "Uygulama dili İngilizce veya Türkçe",
    keywords: ["language", "dil", "locale", "english", "türkçe", "turkish", "i18n"],
  },
  {
    id: "accessibility",
    section: "Appearance",
    titleEn: "Accessibility",
    titleTr: "Erişilebilirlik",
    descriptionEn: "High contrast, reduced motion, larger text, focus ring",
    descriptionTr: "Yüksek kontrast, azaltılmış hareket, büyük yazı, odak halkası",
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
    keywords: ["notification", "bildirim", "sound", "ses", "dnd", "quiet", "sessiz", "badge"],
  },
  {
    id: "voice-microphone",
    section: "Voice & Video",
    titleEn: "Microphone",
    titleTr: "Mikrofon",
    descriptionEn: "Input device, level meter, noise suppression, push-to-talk",
    descriptionTr: "Giriş cihazı, seviye ölçer, gürültü engelleme, bas konuş",
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
    keywords: ["camera", "kamera", "video", "preview", "önizleme", "webcam"],
  },
  {
    id: "privacy-dm",
    section: "Privacy & Safety",
    titleEn: "Direct messages",
    titleTr: "Direkt mesajlar",
    descriptionEn: "Who can DM you and friend request controls",
    descriptionTr: "Kimler DM atabilir ve arkadaşlık isteği kontrolleri",
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
    keywords: ["shortcut", "kısayol", "keyboard", "klavye", "hotkey", "mute", "deafen"],
  },
  {
    id: "windows-startup",
    section: "Windows & Startup",
    titleEn: "Launch on startup",
    titleTr: "Açılışta başlat",
    descriptionEn: "Windows login item, close to tray, window memory",
    descriptionTr: "Windows açılış öğesi, tepsiye küçült, pencere hafızası",
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
    keywords: ["advanced", "gelişmiş", "diagnostics", "tanılama", "webrtc"],
  },
  {
    id: "update",
    section: "Update",
    titleEn: "Updates",
    titleTr: "Güncellemeler",
    descriptionEn: "Check for desktop updates and release channel",
    descriptionTr: "Masaüstü güncellemesi ve yayın kanalı",
    keywords: ["update", "güncelleme", "version", "sürüm", "release"],
  },
  {
    id: "legal",
    section: "Legal",
    titleEn: "Legal",
    titleTr: "Yasal",
    descriptionEn: "Terms, privacy, licenses",
    descriptionTr: "Şartlar, gizlilik, lisanslar",
    keywords: ["legal", "yasal", "terms", "privacy", "gizlilik", "license", "lisans"],
  },
] as const;

function normalizeQuery(query: string): string {
  return query.trim().toLocaleLowerCase("tr-TR");
}

export function searchSettingsCatalog(query: string, language: UiLanguage = "en"): SettingsSearchHit[] {
  const q = normalizeQuery(query);
  if (!q) return [];
  const tokens = q.split(/\s+/).filter(Boolean);
  return SETTINGS_SEARCH_INDEX.filter((hit) => {
    const haystack = [
      hit.titleEn,
      hit.titleTr,
      hit.descriptionEn,
      hit.descriptionTr,
      hit.section,
      ...hit.keywords,
    ]
      .join(" ")
      .toLocaleLowerCase("tr-TR");
    return tokens.every((token) => haystack.includes(token));
  }).map((hit) => hit);
}

/** Search index authors en + tr; other UiLanguage codes use the English pack. */
export function settingsSearchResultLabel(hit: SettingsSearchHit, language: UiLanguage): string {
  return normalizeUiLanguage(language) === "tr" ? hit.titleTr : hit.titleEn;
}

export function settingsSearchResultDescription(hit: SettingsSearchHit, language: UiLanguage): string {
  return normalizeUiLanguage(language) === "tr" ? hit.descriptionTr : hit.descriptionEn;
}
