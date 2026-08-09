import { SUPPORTED_UI_LANGUAGES, normalizeUiLanguage, type UiLanguage } from "./uiLanguages.ts";

type Catalog = Record<string, string>;

const en: Catalog = {
  "hub.title": "HAVOOC Support Hub",
  "hub.subtitle": "A competitive 5v5 experience in development. Support the journey.",
  "hub.close": "Close",
  "hub.roadmap": "Roadmap",
  "hub.roadmap.body": "Foundation systems, combat loops, and community tools ship in stages. Timelines move with real production progress.",
  "hub.media": "Development Media",
  "hub.media.body": "Concept and production stills from the HAVOOC world. Media updates as development continues.",
  "hub.media.empty": "Development media will appear here as assets are published.",
  "hub.community": "Join the Community",
  "hub.kickstarter": "Kickstarter",
  "hub.kickstarter.body": "Follow the campaign when it goes live. This hub stays the home for PICOM community support.",
  "hub.patience": "Game development takes time",
  "hub.patience.body": "HAVOOC is built carefully. Short notes and real support help more than fake metrics.",
  "hub.finalCta": "Help HAVOOC reach the development goal",
  "hub.goal": "Development Goal: €{amount}",
  "notes.title": "Support Notes",
  "notes.subtitle": "Messages from the Community",
  "notes.composerLabel": "Leave a note for HAVOOC",
  "notes.placeholder": "Write a short message…",
  "notes.sign": "Sign",
  "notes.leaveNote": "Leave note",
  "notes.edit": "Edit",
  "notes.delete": "Delete",
  "notes.report": "Report",
  "notes.loadMore": "Load more",
  "notes.sortNewest": "Newest",
  "notes.sortOldest": "Oldest",
  "notes.empty": "Be the first to leave a note for HAVOOC.",
  "notes.wordCounter": "{words} / {max} words",
  "notes.charCounter": "{chars} / {max} characters",
  "notes.ownerBadge": "Project Owner",
  "notes.ctaHelp": "Want to help HAVOOC go further?",
  "notes.donate": "Donate",
  "notes.support": "Support HAVOOC",
  "notes.added": "Your note was added.",
  "notes.updated": "Your note was updated.",
  "notes.removed": "Your note was removed.",
  "notes.reported": "Report submitted.",
  "notes.deleteConfirmTitle": "Remove your note?",
  "notes.deleteConfirmBody": "This removes your support note from the HAVOOC wall.",
  "notes.deleteConfirmAction": "Remove note",
  "notes.cancel": "Cancel",
  "notes.menu": "Note actions",
  "notes.signInRequired": "Sign in to leave a support note.",
  "notes.disabled": "Support Notes are currently unavailable.",
  "errors.NOTE_EMPTY": "Write a short note before signing.",
  "errors.NOTE_WORD_LIMIT": "Notes can be at most 20 words.",
  "errors.NOTE_TOO_LONG": "Notes can be at most 160 characters.",
  "errors.NOTE_LINKS_DENIED": "Links are not allowed in support notes.",
  "errors.RATE_LIMITED": "Please wait a moment before trying again.",
  "errors.AUTH_REQUIRED": "Sign in to leave a support note.",
  "errors.PERMISSION_DENIED": "Permission denied.",
  "errors.RPC_FAILED": "Something went wrong. Try again.",
  "errors.FEATURE_DISABLED": "Support Notes are currently unavailable.",
  "errors.NOTE_NOT_FOUND": "Note not found.",
  "errors.NOTE_REMOVED": "This note was removed by moderation.",
  "errors.ACCOUNT_RESTRICTED": "Your account cannot leave notes right now.",
  "errors.CANNOT_REPORT_OWN": "You cannot report your own note.",
  "report.title": "Report note",
  "report.category": "Category",
  "report.description": "Optional details",
  "report.submit": "Submit report",
  "report.spam": "Spam",
  "report.harassment": "Harassment",
  "report.hate": "Hate",
  "report.scam": "Scam",
  "report.other": "Other",
  "link.picom": "PICOM",
  "link.reddit": "Reddit",
  "link.instagram": "Instagram",
  "link.kickstarter": "Kickstarter",
};

const tr: Catalog = {
  ...en,
  "hub.title": "HAVOOC Destek Merkezi",
  "hub.subtitle": "Geliştirilmekte olan rekabetçi bir 5v5 deneyimi. Yolculuğu destekleyin.",
  "hub.close": "Kapat",
  "hub.roadmap": "Yol Haritası",
  "hub.media": "Geliştirme Medyası",
  "hub.community": "Topluluğa Katıl",
  "hub.kickstarter": "Kickstarter",
  "hub.patience": "Oyun geliştirmek zaman alır",
  "hub.finalCta": "HAVOOC’un geliştirme hedefine ulaşmasına yardım edin",
  "hub.goal": "Geliştirme Hedefi: €{amount}",
  "notes.title": "Destek Notları",
  "notes.subtitle": "Topluluktan Mesajlar",
  "notes.composerLabel": "HAVOOC için bir not bırak",
  "notes.placeholder": "Kısa bir mesaj yaz…",
  "notes.sign": "Not bırak",
  "notes.leaveNote": "Not bırak",
  "notes.edit": "Düzenle",
  "notes.delete": "Sil",
  "notes.report": "Bildir",
  "notes.loadMore": "Daha fazla yükle",
  "notes.sortNewest": "En yeni",
  "notes.sortOldest": "En eski",
  "notes.empty": "HAVOOC için ilk notu sen bırak.",
  "notes.wordCounter": "{words} / {max} kelime",
  "notes.charCounter": "{chars} / {max} karakter",
  "notes.ownerBadge": "Proje Sahibi",
  "notes.ctaHelp": "HAVOOC’un daha ileri gitmesine yardım etmek ister misin?",
  "notes.donate": "Bağış yap",
  "notes.support": "HAVOOC’u destekle",
  "notes.added": "Notun eklendi.",
  "notes.updated": "Notun güncellendi.",
  "notes.removed": "Notun kaldırıldı.",
  "notes.reported": "Bildirim gönderildi.",
  "notes.deleteConfirmTitle": "Notun kaldırılsın mı?",
  "notes.deleteConfirmBody": "Bu işlem destek notunu HAVOOC duvarından kaldırır.",
  "notes.deleteConfirmAction": "Notu kaldır",
  "notes.cancel": "İptal",
  "notes.menu": "Not işlemleri",
  "notes.signInRequired": "Destek notu bırakmak için giriş yap.",
  "notes.disabled": "Destek Notları şu anda kullanılamıyor.",
  "errors.NOTE_EMPTY": "İmzalamadan önce kısa bir not yaz.",
  "errors.NOTE_WORD_LIMIT": "Notlar en fazla 20 kelime olabilir.",
  "errors.NOTE_TOO_LONG": "Notlar en fazla 160 karakter olabilir.",
  "errors.NOTE_LINKS_DENIED": "Destek notlarında bağlantıya izin verilmez.",
  "errors.RATE_LIMITED": "Tekrar denemeden önce biraz bekle.",
  "errors.AUTH_REQUIRED": "Destek notu bırakmak için giriş yap.",
  "report.title": "Notu bildir",
  "report.submit": "Bildirimi gönder",
};

const de: Catalog = {
  ...en,
  "hub.title": "HAVOOC Support-Hub",
  "notes.title": "Support-Notizen",
  "notes.subtitle": "Nachrichten aus der Community",
  "notes.composerLabel": "Hinterlasse eine Notiz für HAVOOC",
  "notes.sign": "Signieren",
  "notes.leaveNote": "Notiz hinterlassen",
  "notes.empty": "Sei der Erste, der eine Notiz für HAVOOC hinterlässt.",
  "notes.added": "Deine Notiz wurde hinzugefügt.",
  "notes.updated": "Deine Notiz wurde aktualisiert.",
  "notes.removed": "Deine Notiz wurde entfernt.",
};

const fr: Catalog = {
  ...en,
  "hub.title": "Centre de soutien HAVOOC",
  "notes.title": "Notes de soutien",
  "notes.subtitle": "Messages de la communauté",
  "notes.composerLabel": "Laissez une note pour HAVOOC",
  "notes.sign": "Signer",
  "notes.leaveNote": "Laisser une note",
  "notes.empty": "Soyez le premier à laisser une note pour HAVOOC.",
  "notes.added": "Votre note a été ajoutée.",
  "notes.updated": "Votre note a été mise à jour.",
  "notes.removed": "Votre note a été retirée.",
};

const es: Catalog = {
  ...en,
  "hub.title": "Centro de apoyo HAVOOC",
  "notes.title": "Notas de apoyo",
  "notes.subtitle": "Mensajes de la comunidad",
  "notes.composerLabel": "Deja una nota para HAVOOC",
  "notes.sign": "Firmar",
  "notes.leaveNote": "Dejar nota",
  "notes.empty": "Sé el primero en dejar una nota para HAVOOC.",
  "notes.added": "Tu nota se agregó.",
  "notes.updated": "Tu nota se actualizó.",
  "notes.removed": "Tu nota se eliminó.",
};

const it: Catalog = {
  ...en,
  "hub.title": "Hub di supporto HAVOOC",
  "notes.title": "Note di supporto",
  "notes.subtitle": "Messaggi dalla community",
  "notes.composerLabel": "Lascia una nota per HAVOOC",
  "notes.sign": "Firma",
  "notes.leaveNote": "Lascia nota",
  "notes.empty": "Sii il primo a lasciare una nota per HAVOOC.",
  "notes.added": "La tua nota è stata aggiunta.",
  "notes.updated": "La tua nota è stata aggiornata.",
  "notes.removed": "La tua nota è stata rimossa.",
};

const pt: Catalog = {
  ...en,
  "hub.title": "Central de apoio HAVOOC",
  "notes.title": "Notas de apoio",
  "notes.subtitle": "Mensagens da comunidade",
  "notes.composerLabel": "Deixe uma nota para o HAVOOC",
  "notes.sign": "Assinar",
  "notes.leaveNote": "Deixar nota",
  "notes.empty": "Seja o primeiro a deixar uma nota para o HAVOOC.",
  "notes.added": "Sua nota foi adicionada.",
  "notes.updated": "Sua nota foi atualizada.",
  "notes.removed": "Sua nota foi removida.",
};

const ru: Catalog = {
  ...en,
  "hub.title": "Центр поддержки HAVOOC",
  "notes.title": "Заметки поддержки",
  "notes.subtitle": "Сообщения сообщества",
  "notes.composerLabel": "Оставьте заметку для HAVOOC",
  "notes.sign": "Подписать",
  "notes.leaveNote": "Оставить заметку",
  "notes.empty": "Будьте первым, кто оставит заметку для HAVOOC.",
  "notes.added": "Ваша заметка добавлена.",
  "notes.updated": "Ваша заметка обновлена.",
  "notes.removed": "Ваша заметка удалена.",
};

const ar: Catalog = {
  ...en,
  "hub.title": "مركز دعم HAVOOC",
  "notes.title": "ملاحظات الدعم",
  "notes.subtitle": "رسائل من المجتمع",
  "notes.composerLabel": "اترك ملاحظة لـ HAVOOC",
  "notes.sign": "وقّع",
  "notes.leaveNote": "اترك ملاحظة",
  "notes.empty": "كن أول من يترك ملاحظة لـ HAVOOC.",
  "notes.added": "تمت إضافة ملاحظتك.",
  "notes.updated": "تم تحديث ملاحظتك.",
  "notes.removed": "تمت إزالة ملاحظتك.",
  "notes.loadMore": "تحميل المزيد",
  "notes.edit": "تعديل",
  "notes.delete": "حذف",
  "notes.report": "إبلاغ",
};

const ja: Catalog = {
  ...en,
  "hub.title": "HAVOOC サポートハブ",
  "notes.title": "サポートノート",
  "notes.subtitle": "コミュニティからのメッセージ",
  "notes.composerLabel": "HAVOOC にノートを残す",
  "notes.sign": "サイン",
  "notes.leaveNote": "ノートを残す",
  "notes.empty": "HAVOOC に最初のノートを残しましょう。",
  "notes.added": "ノートが追加されました。",
  "notes.updated": "ノートが更新されました。",
  "notes.removed": "ノートが削除されました。",
};

const CATALOGS: Record<UiLanguage, Catalog> = {
  en,
  tr,
  de,
  fr,
  es,
  it,
  pt,
  ru,
  ar,
  ja,
};

export type HavoocSupportI18nKey = keyof typeof en;

export function translateHavoocSupport(
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

export function assertHavoocSupportLocaleParity(): void {
  const keys = Object.keys(en).sort();
  for (const locale of SUPPORTED_UI_LANGUAGES) {
    const catalogKeys = Object.keys(CATALOGS[locale]).sort();
    if (catalogKeys.join("\0") !== keys.join("\0")) {
      throw new Error(`havooc support catalog parity failed for ${locale}`);
    }
  }
}
