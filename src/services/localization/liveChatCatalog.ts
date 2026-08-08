import { SUPPORTED_UI_LANGUAGES, normalizeUiLanguage, type UiLanguage } from "./uiLanguages.ts";

type Catalog = Record<string, string>;

const en: Catalog = {
  "liveChat.title": "Live chat",
  "liveChat.connecting": "Connecting…",
  "liveChat.connected": "Connected",
  "liveChat.reconnecting": "Reconnecting…",
  "liveChat.offline": "Offline",
  "liveChat.empty": "No messages yet.",
  "liveChat.composerPlaceholder": "Send a message",
  "liveChat.send": "Send",
  "liveChat.removed": "Message removed by moderator",
  "chatDisabled.title": "Chat disabled",
  "chatDisabled.body": "The publisher disabled chat for this stream.",
  "chatConnecting": "Connecting to chat…",
  "chatReconnecting": "Chat reconnecting…",
  "slowMode.label": "Slow mode: {seconds}s",
  "slowMode.wait": "Wait {seconds}s",
  "timedOut.title": "Timed out",
  "timedOut.body": "You can send messages again after the timeout ends.",
  "banned.title": "Banned from chat",
  "banned.body": "You cannot send messages in this stream chat.",
  "followersOnly.title": "Followers only",
  "followersOnly.body": "Follow the publisher to chat.",
  "verifiedOnly.title": "Verified only",
  "verifiedOnly.body": "Verified accounts can chat here.",
  "moderator.badge": "Mod",
  "moderators.title": "Moderators",
  "moderators.assign": "Assign moderator",
  "moderators.remove": "Remove moderator",
  "moderators.userId": "User ID",
  "pin.action": "Pin",
  "unpin.action": "Unpin",
  "pin.banner": "Pinned message",
  "timeout.action": "Timeout",
  "timeout.confirm": "Timeout this user?",
  "ban.action": "Ban",
  "ban.confirm": "Ban this user from chat?",
  "unban.action": "Unban",
  "unban.confirm": "Remove this chat ban?",
  "report.action": "Report",
  "report.submit": "Submit report",
  "report.category": "Category",
  "deleteMessage.action": "Delete message",
  "deleteMessage.confirm": "Remove this message for everyone?",
  "chatSettings.title": "Chat settings",
  "chatSettings.enable": "Chat enabled",
  "chatSettings.slowMode": "Slow mode",
  "chatSettings.followersOnly": "Followers only",
  "chatSettings.verifiedOnly": "Verified only",
  "chatSettings.linksAllowed": "Links allowed",
  "chatSettings.reactionsEnabled": "Reactions enabled",
  "chatSettings.save": "Save settings",
  "linkNotAllowed": "Links are not allowed in this chat.",
  "rateLimited": "You are sending too quickly. Try again soon.",
  "messageTooLong": "Message is too long.",
  "moderationReason": "Reason",
  "controlRoom.moderation": "Moderation console",
  "controlRoom.recentChat": "Recent chat",
  "controlRoom.queue": "Reports",
  "controlRoom.timeouts": "Timed out",
  "controlRoom.bans": "Banned",
  "controlRoom.audit": "Recent actions",
  "chatMessage.system": "System",
  "errors.FEATURE_DISABLED": "Live chat is disabled.",
  "errors.FORBIDDEN": "Permission denied.",
  "errors.RPC_FAILED": "Chat request failed.",
};

const tr: Catalog = {
  ...en,
  "liveChat.title": "Canlı sohbet",
  "liveChat.connecting": "Bağlanıyor…",
  "liveChat.connected": "Bağlı",
  "liveChat.reconnecting": "Yeniden bağlanıyor…",
  "liveChat.offline": "Çevrimdışı",
  "liveChat.empty": "Henüz mesaj yok.",
  "liveChat.composerPlaceholder": "Mesaj gönder",
  "liveChat.send": "Gönder",
  "liveChat.removed": "Mesaj moderatör tarafından kaldırıldı",
  "chatDisabled.title": "Sohbet kapalı",
  "chatDisabled.body": "Yayıncı bu yayın için sohbeti kapattı.",
  "slowMode.label": "Yavaş mod: {seconds}sn",
  "timedOut.title": "Süre aşımı",
  "banned.title": "Sohbetten yasaklandınız",
  "followersOnly.title": "Yalnızca takipçiler",
  "verifiedOnly.title": "Yalnızca doğrulanmış",
  "moderator.badge": "Mod",
  "pin.action": "Sabitle",
  "unpin.action": "Sabitlemeyi kaldır",
  "timeout.action": "Süre ver",
  "ban.action": "Yasakla",
  "unban.action": "Yasağı kaldır",
  "report.action": "Bildir",
  "deleteMessage.action": "Mesajı sil",
  "chatSettings.title": "Sohbet ayarları",
  "linkNotAllowed": "Bu sohbette bağlantılara izin verilmiyor.",
  "rateLimited": "Çok hızlı mesaj gönderiyorsunuz.",
  "messageTooLong": "Mesaj çok uzun.",
  "controlRoom.moderation": "Moderasyon konsolu",
};

const ar: Catalog = {
  ...en,
  "liveChat.title": "الدردشة المباشرة",
  "liveChat.connecting": "جارٍ الاتصال…",
  "liveChat.connected": "متصل",
  "liveChat.reconnecting": "إعادة الاتصال…",
  "liveChat.offline": "غير متصل",
  "liveChat.empty": "لا توجد رسائل بعد.",
  "liveChat.composerPlaceholder": "أرسل رسالة",
  "liveChat.send": "إرسال",
  "liveChat.removed": "تمت إزالة الرسالة بواسطة المشرف",
  "chatDisabled.title": "الدردشة معطّلة",
  "slowMode.label": "الوضع البطيء: {seconds}ث",
  "timedOut.title": "مهلة زمنية",
  "banned.title": "محظور من الدردشة",
  "followersOnly.title": "المتابعون فقط",
  "verifiedOnly.title": "الحسابات الموثّقة فقط",
  "moderator.badge": "مشرف",
  "pin.action": "تثبيت",
  "unpin.action": "إلغاء التثبيت",
  "timeout.action": "مهلة",
  "ban.action": "حظر",
  "unban.action": "رفع الحظر",
  "report.action": "بلاغ",
  "deleteMessage.action": "حذف الرسالة",
  "chatSettings.title": "إعدادات الدردشة",
  "controlRoom.moderation": "وحدة الإشراف",
};

function pack(base: Catalog): Catalog {
  return { ...base };
}

export type LiveChatI18nKey = keyof typeof en;

export const LIVE_CHAT_LOCALES: Readonly<Record<UiLanguage, Catalog>> = {
  en: pack(en),
  tr: pack(tr),
  de: pack(en),
  fr: pack(en),
  es: pack(en),
  it: pack(en),
  pt: pack(en),
  ru: pack(en),
  ar: pack(ar),
  ja: pack(en),
};

export const LIVE_CHAT_I18N_KEYS = Object.keys(en) as LiveChatI18nKey[];

export function translateLiveChat(
  key: LiveChatI18nKey,
  language: UiLanguage | string = "en",
  params: Record<string, string | number> = {},
): string {
  const locale = normalizeUiLanguage(language);
  const template = LIVE_CHAT_LOCALES[locale][key];
  if (typeof template !== "string" || !template.trim()) {
    throw new Error(`Missing live chat i18n key ${key} for locale ${locale}`);
  }
  return template.replace(/\{(\w+)\}/g, (_match, name: string) => String(params[name] ?? ""));
}

export function assertLiveChatLocaleParity(): { ok: true } | { ok: false; detail: string } {
  const enKeys = Object.keys(LIVE_CHAT_LOCALES.en).sort();
  for (const locale of SUPPORTED_UI_LANGUAGES) {
    const keys = Object.keys(LIVE_CHAT_LOCALES[locale]).sort();
    if (keys.length !== enKeys.length || keys.some((k, i) => k !== enKeys[i])) {
      return { ok: false, detail: `${locale} key set mismatch` };
    }
    for (const key of enKeys) {
      const value = LIVE_CHAT_LOCALES[locale][key];
      if (typeof value !== "string" || !value.trim()) {
        return { ok: false, detail: `${locale}.${key} empty` };
      }
    }
  }
  return { ok: true };
}
