/**
 * Electron main-process locale catalog.
 *
 * The main process is CommonJS (.cts) and cannot import the renderer's ESM/JSON i18n
 * runtime (src/i18n), so this is a deliberate standalone mirror for the small set of
 * strings the main process owns: tray menu, tray tooltip, and native notification titles.
 *
 * The language list MUST stay identical to SUPPORTED_UI_LANGUAGES in
 * src/services/localization/uiLanguages.ts. scripts/electron-locale-bridge-smoke.mjs
 * enforces that, plus key-set parity, non-empty values, and no accidental
 * English copies in non-English locales.
 */

export const MAIN_LOCALES = ["en", "tr", "de", "fr", "es", "it", "pt", "nl", "pl", "ru"] as const;
export type MainLocale = (typeof MAIN_LOCALES)[number];
export const DEFAULT_MAIN_LOCALE: MainLocale = "en";

export type MainLocaleKey =
  | "tray.openCompanion"
  | "tray.openDesktop"
  | "tray.setStatus"
  | "tray.status.online"
  | "tray.status.idle"
  | "tray.status.dnd"
  | "tray.status.invisible"
  | "tray.muteNotifications"
  | "tray.settings"
  | "tray.quit"
  | "tray.tooltipMuted"
  | "notification.incomingCall"
  | "notification.testTitle"
  | "notification.testBody";

type Catalog = Record<MainLocaleKey, string>;

const en: Catalog = {
  "tray.openCompanion": "Open Picom Companion",
  "tray.openDesktop": "Open Picom Desktop",
  "tray.setStatus": "Set Status",
  "tray.status.online": "Online",
  "tray.status.idle": "Idle",
  "tray.status.dnd": "Do Not Disturb",
  "tray.status.invisible": "Invisible",
  "tray.muteNotifications": "Mute Notifications",
  "tray.settings": "Settings",
  "tray.quit": "Quit",
  "tray.tooltipMuted": "muted",
  "notification.incomingCall": "Picom Incoming Call",
  "notification.testTitle": "PICOM test notification",
  "notification.testBody": "Your desktop notifications are ready for testing.",
};

const tr: Catalog = {
  "tray.openCompanion": "Picom Companion'ı aç",
  "tray.openDesktop": "Picom Desktop'ı aç",
  "tray.setStatus": "Durumu ayarla",
  "tray.status.online": "Çevrimiçi",
  "tray.status.idle": "Boşta",
  "tray.status.dnd": "Rahatsız etmeyin",
  "tray.status.invisible": "Görünmez",
  "tray.muteNotifications": "Bildirimleri sessize al",
  "tray.settings": "Ayarlar",
  "tray.quit": "Çıkış",
  "tray.tooltipMuted": "sessizde",
  "notification.incomingCall": "Picom Gelen Arama",
  "notification.testTitle": "PICOM test bildirimi",
  "notification.testBody": "Masaüstü bildirimleriniz test için hazır.",
};

const de: Catalog = {
  "tray.openCompanion": "Picom Companion öffnen",
  "tray.openDesktop": "Picom Desktop öffnen",
  "tray.setStatus": "Status festlegen",
  "tray.status.online": "Online",
  "tray.status.idle": "Abwesend",
  "tray.status.dnd": "Nicht stören",
  "tray.status.invisible": "Unsichtbar",
  "tray.muteNotifications": "Benachrichtigungen stummschalten",
  "tray.settings": "Einstellungen",
  "tray.quit": "Beenden",
  "tray.tooltipMuted": "stummgeschaltet",
  "notification.incomingCall": "Picom Eingehender Anruf",
  "notification.testTitle": "PICOM-Testbenachrichtigung",
  "notification.testBody": "Ihre Desktop-Benachrichtigungen sind bereit zum Testen.",
};

const fr: Catalog = {
  "tray.openCompanion": "Ouvrir Picom Companion",
  "tray.openDesktop": "Ouvrir Picom Desktop",
  "tray.setStatus": "Définir le statut",
  "tray.status.online": "En ligne",
  "tray.status.idle": "Inactif",
  "tray.status.dnd": "Ne pas déranger",
  "tray.status.invisible": "Invisible",
  "tray.muteNotifications": "Couper les notifications",
  "tray.settings": "Paramètres",
  "tray.quit": "Quitter",
  "tray.tooltipMuted": "en sourdine",
  "notification.incomingCall": "Picom Appel entrant",
  "notification.testTitle": "Notification de test PICOM",
  "notification.testBody": "Vos notifications de bureau sont prêtes à être testées.",
};

const es: Catalog = {
  "tray.openCompanion": "Abrir Picom Companion",
  "tray.openDesktop": "Abrir Picom Desktop",
  "tray.setStatus": "Establecer estado",
  "tray.status.online": "En línea",
  "tray.status.idle": "Ausente",
  "tray.status.dnd": "No molestar",
  "tray.status.invisible": "Invisible",
  "tray.muteNotifications": "Silenciar notificaciones",
  "tray.settings": "Ajustes",
  "tray.quit": "Salir",
  "tray.tooltipMuted": "silenciado",
  "notification.incomingCall": "Picom Llamada entrante",
  "notification.testTitle": "Notificación de prueba de PICOM",
  "notification.testBody": "Tus notificaciones de escritorio están listas para probarse.",
};

const it: Catalog = {
  "tray.openCompanion": "Apri Picom Companion",
  "tray.openDesktop": "Apri Picom Desktop",
  "tray.setStatus": "Imposta stato",
  "tray.status.online": "In linea",
  "tray.status.idle": "Inattivo",
  "tray.status.dnd": "Non disturbare",
  "tray.status.invisible": "Invisibile",
  "tray.muteNotifications": "Disattiva le notifiche",
  "tray.settings": "Impostazioni",
  "tray.quit": "Esci",
  "tray.tooltipMuted": "silenziato",
  "notification.incomingCall": "Picom Chiamata in arrivo",
  "notification.testTitle": "Notifica di prova PICOM",
  "notification.testBody": "Le notifiche desktop sono pronte per il test.",
};

const pt: Catalog = {
  "tray.openCompanion": "Abrir o Picom Companion",
  "tray.openDesktop": "Abrir o Picom Desktop",
  "tray.setStatus": "Definir status",
  "tray.status.online": "On-line",
  "tray.status.idle": "Ausente",
  "tray.status.dnd": "Não perturbe",
  "tray.status.invisible": "Invisível",
  "tray.muteNotifications": "Silenciar notificações",
  "tray.settings": "Configurações",
  "tray.quit": "Sair",
  "tray.tooltipMuted": "silenciado",
  "notification.incomingCall": "Picom Chamada recebida",
  "notification.testTitle": "Notificação de teste do PICOM",
  "notification.testBody": "Suas notificações da área de trabalho estão prontas para teste.",
};

const nl: Catalog = {
  "tray.openCompanion": "Picom Companion openen",
  "tray.openDesktop": "Picom Desktop openen",
  "tray.setStatus": "Status instellen",
  "tray.status.online": "Online",
  "tray.status.idle": "Afwezig",
  "tray.status.dnd": "Niet storen",
  "tray.status.invisible": "Onzichtbaar",
  "tray.muteNotifications": "Meldingen dempen",
  "tray.settings": "Instellingen",
  "tray.quit": "Afsluiten",
  "tray.tooltipMuted": "gedempt",
  "notification.incomingCall": "Picom Inkomende oproep",
  "notification.testTitle": "PICOM-testmelding",
  "notification.testBody": "Je bureaubladmeldingen zijn klaar om te testen.",
};

const pl: Catalog = {
  "tray.openCompanion": "Otwórz Picom Companion",
  "tray.openDesktop": "Otwórz Picom Desktop",
  "tray.setStatus": "Ustaw status",
  "tray.status.online": "Dostępny",
  "tray.status.idle": "Zaraz wracam",
  "tray.status.dnd": "Nie przeszkadzać",
  "tray.status.invisible": "Niewidoczny",
  "tray.muteNotifications": "Wycisz powiadomienia",
  "tray.settings": "Ustawienia",
  "tray.quit": "Zakończ",
  "tray.tooltipMuted": "wyciszone",
  "notification.incomingCall": "Picom Połączenie przychodzące",
  "notification.testTitle": "Powiadomienie testowe PICOM",
  "notification.testBody": "Powiadomienia na pulpicie są gotowe do przetestowania.",
};

const ru: Catalog = {
  "tray.openCompanion": "Открыть Picom Companion",
  "tray.openDesktop": "Открыть Picom Desktop",
  "tray.setStatus": "Установить статус",
  "tray.status.online": "В сети",
  "tray.status.idle": "Не активен",
  "tray.status.dnd": "Не беспокоить",
  "tray.status.invisible": "Невидимый",
  "tray.muteNotifications": "Отключить уведомления",
  "tray.settings": "Настройки",
  "tray.quit": "Выйти",
  "tray.tooltipMuted": "без звука",
  "notification.incomingCall": "Picom Входящий вызов",
  "notification.testTitle": "Тестовое уведомление PICOM",
  "notification.testBody": "Ваши уведомления на рабочем столе готовы к проверке.",
};

const CATALOGS: Record<MainLocale, Catalog> = { en, tr, de, fr, es, it, pt, nl, pl, ru };

export function isMainLocale(value: unknown): value is MainLocale {
  return typeof value === "string" && (MAIN_LOCALES as readonly string[]).includes(value);
}

/** Unknown / corrupt values normalize to English; never throws. */
export function normalizeMainLocale(value: unknown): MainLocale {
  if (isMainLocale(value)) return value;
  if (typeof value === "string") {
    const base = value.trim().toLowerCase().split(/[-_]/)[0] ?? "";
    if (isMainLocale(base)) return base;
  }
  return DEFAULT_MAIN_LOCALE;
}

let activeLocale: MainLocale = DEFAULT_MAIN_LOCALE;

export function setMainLocale(value: unknown): MainLocale {
  activeLocale = normalizeMainLocale(value);
  return activeLocale;
}

export function getMainLocale(): MainLocale {
  return activeLocale;
}

export function translateMain(key: MainLocaleKey, locale: MainLocale = activeLocale): string {
  const catalog = CATALOGS[normalizeMainLocale(locale)];
  const value = catalog[key];
  return typeof value === "string" && value.trim() ? value : en[key];
}

export const MAIN_LOCALE_CATALOGS = CATALOGS;
