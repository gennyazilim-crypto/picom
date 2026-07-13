import type { SettingsSection, UiLanguage } from "./settingsService";

export type LocalizationKey =
  | "settings.title" | "settings.close" | "appearance.title" | "appearance.description"
  | "theme.light" | "theme.lightHint" | "theme.dark" | "theme.darkHint" | "theme.system" | "theme.systemHint"
  | "accessibility.title" | "accessibility.description" | "accessibility.highContrast" | "accessibility.highContrastHint"
  | "accessibility.reducedMotion" | "accessibility.reducedMotionHint" | "accessibility.largerText" | "accessibility.largerTextHint"
  | "accessibility.focusRing" | "accessibility.focusRingHint" | "appearance.language" | "appearance.languageHint"
  | "appearance.density" | "appearance.densityHint" | "appearance.dateStyle" | "appearance.dateStyleHint"
  | "appearance.timeFormat" | "appearance.timeFormatHint";

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
};

const sectionTr: Record<SettingsSection, string> = {
  "Account": "Hesap", "Profile": "Profil", "Privacy & Safety": "Gizlilik ve Güvenlik", "Appearance": "Görünüm",
  "Notifications": "Bildirimler", "Voice & Video": "Ses ve Video", "Keyboard Shortcuts": "Klavye Kısayolları",
  "Diagnostics": "Tanılama", "Admin Operations": "Yönetim", "Legal": "Yasal", "Advanced": "Gelişmiş",
};

let activeLanguage: UiLanguage = "en";

export const localizationService = {
  setLanguage(language: UiLanguage): void { activeLanguage = language; },
  getLanguage(): UiLanguage { return activeLanguage; },
  translate(key: LocalizationKey, language = activeLanguage): string { return (language === "tr" ? tr : en)[key]; },
  translateSettingsSection(section: SettingsSection, language = activeLanguage): string { return language === "tr" ? sectionTr[section] : section; },
};
