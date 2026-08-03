/**
 * Publisher / Creator program UI catalogs — canonical 10 UiLanguage locales.
 * en + tr are authored; other locales ship complete non-empty English packs
 * (explicit tables — not silent runtime English fallback).
 */
import type { UiLanguage } from "./uiLanguages.ts";
import { SUPPORTED_UI_LANGUAGES, normalizeUiLanguage, getUiLanguageBcp47 } from "./uiLanguages.ts";

export type PublisherProgramI18nKey =
  | "apply.aria"
  | "apply.eyebrow"
  | "apply.ready"
  | "apply.belowThreshold"
  | "apply.title"
  | "apply.lede"
  | "apply.refresh"
  | "apply.refreshAria"
  | "apply.dashboard"
  | "apply.close"
  | "apply.loading"
  | "apply.snapshotTitle"
  | "apply.lastCheck"
  | "apply.followers"
  | "apply.largestCommunity"
  | "apply.countedCommunity"
  | "apply.noCommunity"
  | "apply.accountGate"
  | "apply.liveBan"
  | "apply.accountInactive"
  | "apply.accountOk"
  | "apply.pathsTitle"
  | "apply.pathsBody"
  | "apply.followerPath"
  | "apply.followerDetail"
  | "apply.or"
  | "apply.communityPath"
  | "apply.communityDetailNamed"
  | "apply.communityDetailDefault"
  | "apply.applicationsTitle"
  | "apply.formTitle"
  | "apply.formLede"
  | "apply.typeLabel"
  | "apply.typeCreator"
  | "apply.typePublisher"
  | "apply.displayName"
  | "apply.displayPlaceholder"
  | "apply.bio"
  | "apply.bioPlaceholder"
  | "apply.company"
  | "apply.submit"
  | "apply.submitting"
  | "apply.nextTitle"
  | "apply.growFollowersTitle"
  | "apply.growFollowersBody"
  | "apply.growCommunityTitle"
  | "apply.growCommunityBodyNamed"
  | "apply.growCommunityBodyDefault"
  | "apply.asideLabel"
  | "apply.afterKicker"
  | "apply.afterTitle"
  | "apply.afterBadge"
  | "apply.afterDiscovery"
  | "apply.afterGate"
  | "apply.afterSafety"
  | "apply.processKicker"
  | "apply.processTitle"
  | "apply.processStep1"
  | "apply.processStep2"
  | "apply.processStep3"
  | "apply.processStep4"
  | "apply.rulesKicker"
  | "apply.rulesTitle"
  | "apply.rulesFollowers"
  | "apply.rulesCommunity"
  | "apply.rulesOwner"
  | "apply.rulesNoMerge"
  | "apply.elig.notEligible"
  | "apply.elig.both"
  | "apply.elig.followers"
  | "apply.elig.community"
  | "apply.elig.ok"
  | "apply.closer.tie"
  | "apply.closer.followers"
  | "apply.closer.community"
  | "apply.track.met"
  | "apply.track.open"
  | "apply.track.remaining"
  | "apply.track.progressAria"
  | "dash.aria"
  | "dash.title"
  | "dash.gatedBody"
  | "dash.noBroadcast"
  | "dash.viewApplication"
  | "dash.eyebrow"
  | "dash.fallbackName"
  | "dash.badgeActive"
  | "dash.badgeLoading"
  | "dash.goLive"
  | "dash.close"
  | "dash.tabsAria"
  | "dash.tab.overview"
  | "dash.tab.streams"
  | "dash.tab.create"
  | "dash.tab.schedule"
  | "dash.tab.settings"
  | "dash.overviewTitle"
  | "dash.overviewBody"
  | "dash.overviewBilling"
  | "dash.scheduleTitle"
  | "dash.scheduleEmpty"
  | "dash.planTitle"
  | "dash.planName"
  | "dash.planStart"
  | "dash.planSubmit"
  | "dash.settingsTitle"
  | "dash.accountKind"
  | "dash.profileStatus"
  | "dash.applicationHistory"
  | "review.eyebrow"
  | "review.title"
  | "review.lede"
  | "review.status"
  | "review.eligibility"
  | "review.reason"
  | "review.refresh"
  | "review.filter.all"
  | "review.filter.follower"
  | "review.filter.community"
  | "review.filter.both"
  | "review.filter.below"
  | "review.filter.fraud"
  | "review.paths"
  | "review.followers"
  | "review.members"
  | "review.community"
  | "review.owner"
  | "review.notOwner"
  | "review.risk"
  | "review.riskDrop"
  | "review.approve"
  | "review.underReview"
  | "review.reject"
  | "review.suspend"
  | "review.liveBan"
  | "review.empty"
  | "review.defaultReason"
  | "review.banReason";

type Catalog = Record<PublisherProgramI18nKey, string>;

const en: Catalog = {
  "apply.aria": "Creator Publisher application",
  "apply.eyebrow": "Publisher Program",
  "apply.ready": "Ready to apply",
  "apply.belowThreshold": "Below threshold",
  "apply.title": "Creator / Publisher application",
  "apply.lede":
    "Public Live Now streaming requires Creator or Publisher approval. Eligibility is calculated on the server; counters here are informational and are not the authorization source.",
  "apply.refresh": "Refresh",
  "apply.refreshAria": "Refresh eligibility",
  "apply.dashboard": "Dashboard",
  "apply.close": "Close",
  "apply.loading": "Checking eligibility…",
  "apply.snapshotTitle": "Live eligibility snapshot",
  "apply.lastCheck": "Last check · {time}",
  "apply.followers": "Active followers",
  "apply.largestCommunity": "Largest owned community",
  "apply.countedCommunity": "Counted community",
  "apply.noCommunity": "No countable community yet",
  "apply.accountGate": "Account / live gate",
  "apply.liveBan": "Active live ban — application or streaming blocked",
  "apply.accountInactive": "Account is not active",
  "apply.accountOk": "Account looks eligible",
  "apply.pathsTitle": "Application paths",
  "apply.pathsBody":
    "One path is enough. Member counts are not merged across communities; only the largest active community you own is counted.",
  "apply.followerPath": "Follower path",
  "apply.followerDetail": "Active Picom follower threshold · server count",
  "apply.or": "OR",
  "apply.communityPath": "Community founder path",
  "apply.communityDetailNamed": "{name} · active members (owner)",
  "apply.communityDetailDefault": "Largest owned community · active members (owner)",
  "apply.applicationsTitle": "Your applications",
  "apply.formTitle": "Application form",
  "apply.formLede":
    "After approval, your Live Now identity is matched to this information. Reviewers see the text you submit.",
  "apply.typeLabel": "Application type",
  "apply.typeCreator": "Creator (individual)",
  "apply.typePublisher": "Publisher (organization)",
  "apply.displayName": "Publisher display name",
  "apply.displayPlaceholder": "Visible stream name",
  "apply.bio": "Short bio",
  "apply.bioPlaceholder": "Briefly tell viewers who you are and what you stream",
  "apply.company": "Company / organization name",
  "apply.submit": "Submit application",
  "apply.submitting": "Submitting…",
  "apply.nextTitle": "How to progress",
  "apply.growFollowersTitle": "Grow the follower path",
  "apply.growFollowersBody":
    "{count} more active followers needed for the threshold. Passive or deleted accounts do not count; the server applies active profile rules.",
  "apply.growCommunityTitle": "Grow the community path",
  "apply.growCommunityBodyNamed":
    "“{name}” needs {count} more active members. Even as founder, membership and an active profile are required; communities are not merged.",
  "apply.growCommunityBodyDefault":
    "Your largest owned community needs {count} more active members. Even as founder, membership and an active profile are required; communities are not merged.",
  "apply.asideLabel": "Program summary",
  "apply.afterKicker": "After approval",
  "apply.afterTitle": "What unlocks?",
  "apply.afterBadge": "Creator / Publisher badge and publisher profile",
  "apply.afterDiscovery": "Public discovery visibility on Picom Live Now",
  "apply.afterGate": "Go Live gate (active badge + approved application)",
  "apply.afterSafety": "Continued streaming subject to review and safety rules",
  "apply.processKicker": "Process",
  "apply.processTitle": "Application flow",
  "apply.processStep1": "Complete one of the thresholds",
  "apply.processStep2": "Submit the application form",
  "apply.processStep3": "Review: eligibility risk and content policy checks",
  "apply.processStep4": "Approval → badge; rejection / more info appears here",
  "apply.rulesKicker": "Counting rules",
  "apply.rulesTitle": "What counts?",
  "apply.rulesFollowers": "Followers: {count} active followers",
  "apply.rulesCommunity": "Community: {count} active members in a community you own",
  "apply.rulesOwner": "Owner source: communities.owner_id",
  "apply.rulesNoMerge": "No member merging · progress bars are not authorization",
  "apply.elig.notEligible":
    "You do not meet application requirements yet. Complete one of the paths below to unlock the form.",
  "apply.elig.both": "You meet both application criteria. You can submit your application.",
  "apply.elig.followers": "You met the follower criterion. You can apply as Creator / Publisher.",
  "apply.elig.community": "You met the community founder criterion. You can apply as Creator / Publisher.",
  "apply.elig.ok": "Application requirements met.",
  "apply.closer.tie": "Both paths are similarly distant; grow whichever fits you.",
  "apply.closer.followers": "The follower path is numerically closer right now.",
  "apply.closer.community": "Your largest owned community path is closer right now.",
  "apply.track.met": "Met",
  "apply.track.open": "Path open",
  "apply.track.remaining": "Remaining {count}",
  "apply.track.progressAria": "{label} progress",
  "dash.aria": "Publisher Dashboard",
  "dash.title": "Publisher Dashboard",
  "dash.gatedBody": "Only approved Creator/Publisher accounts can access this area.",
  "dash.noBroadcast": "Your account does not have broadcast permission yet.",
  "dash.viewApplication": "View application status",
  "dash.eyebrow": "Publisher Dashboard",
  "dash.fallbackName": "Publisher panel",
  "dash.badgeActive": "Active badge: {type}",
  "dash.badgeLoading": "Loading badge status…",
  "dash.goLive": "Go Live",
  "dash.close": "Close",
  "dash.tabsAria": "Publisher sections",
  "dash.tab.overview": "overview",
  "dash.tab.streams": "streams",
  "dash.tab.create": "create",
  "dash.tab.schedule": "schedule",
  "dash.tab.settings": "settings",
  "dash.overviewTitle": "Overview",
  "dash.overviewBody":
    "Use Go Live to start a stream. Live Now lists only public_discovery streams with an approved badge.",
  "dash.overviewBilling": "Revenue / subscriptions / ads: not configured yet (no billing provider).",
  "dash.scheduleTitle": "Stream schedule",
  "dash.scheduleEmpty": "No scheduled streams.",
  "dash.planTitle": "Schedule a stream",
  "dash.planName": "Title",
  "dash.planStart": "Start",
  "dash.planSubmit": "Add to calendar",
  "dash.settingsTitle": "Account verification",
  "dash.accountKind": "Account kind: {kind}",
  "dash.profileStatus": "Profile status: {status}",
  "dash.applicationHistory": "Application history",
  "review.eyebrow": "Care & Safety",
  "review.title": "Publisher & Creator Review",
  "review.lede":
    "Meeting a threshold is not automatic approval. Snapshot and current counts are reviewed together.",
  "review.status": "Status",
  "review.eligibility": "Eligibility filter",
  "review.reason": "Decision reason",
  "review.refresh": "Refresh",
  "review.filter.all": "all",
  "review.filter.follower": "Follower criterion",
  "review.filter.community": "Community criterion",
  "review.filter.both": "Both criteria",
  "review.filter.below": "Now below threshold",
  "review.filter.fraud": "Fraud review",
  "review.paths": "Eligibility paths",
  "review.followers": "Followers (app → now)",
  "review.members": "Community members (app → now)",
  "review.community": "Qualified community",
  "review.owner": " (owner)",
  "review.notOwner": " (not owner now)",
  "review.risk": "Risk",
  "review.riskDrop": "Risk warning: unusual count drop after application.",
  "review.approve": "Approve",
  "review.underReview": "Under review",
  "review.reject": "Reject",
  "review.suspend": "Suspend",
  "review.liveBan": "Live ban",
  "review.empty": "Queue empty.",
  "review.defaultReason": "Reviewed by Root Panel",
  "review.banReason": "Live ban from review panel",
};

const tr: Catalog = {
  ...en,
  "apply.aria": "Creator Publisher başvurusu",
  "apply.eyebrow": "Publisher Program",
  "apply.ready": "Başvuruya hazır",
  "apply.belowThreshold": "Eşik altı",
  "apply.title": "Creator / Publisher başvurusu",
  "apply.lede":
    "Picom Live Now’da kamuya açık yayın yapmak için Creator veya Publisher onayı gerekir. Uygunluk sunucu tarafında hesaplanır; bu ekrandaki sayaçlar bilgilendirme içindir, yetki kaynağı değildir.",
  "apply.refresh": "Yenile",
  "apply.refreshAria": "Uygunluğu yenile",
  "apply.dashboard": "Dashboard",
  "apply.close": "Kapat",
  "apply.loading": "Uygunluk kontrol ediliyor…",
  "apply.snapshotTitle": "Canlı uygunluk özeti",
  "apply.lastCheck": "Son kontrol · {time}",
  "apply.followers": "Aktif takipçi",
  "apply.largestCommunity": "En büyük sahip olunan topluluk",
  "apply.countedCommunity": "Sayılan topluluk",
  "apply.noCommunity": "Henüz sayılacak bir topluluk yok",
  "apply.accountGate": "Hesap / yayın engeli",
  "apply.liveBan": "Aktif live ban — başvuru veya yayın engellenir",
  "apply.accountInactive": "Hesap aktif değil",
  "apply.accountOk": "Hesap uygun görünüyor",
  "apply.pathsTitle": "Başvuru yolları",
  "apply.pathsBody":
    "Tek yol yeterli. Üye sayıları farklı topluluklar arasında birleştirilmez; yalnızca owner olduğunuz en büyük aktif topluluk sayılır.",
  "apply.followerPath": "Takipçi yolu",
  "apply.followerDetail": "Aktif Picom takipçi eşiği · sunucu sayımı",
  "apply.or": "VEYA",
  "apply.communityPath": "Topluluk kurucusu yolu",
  "apply.communityDetailNamed": "{name} · aktif üye (owner)",
  "apply.communityDetailDefault": "En büyük sahip olunan topluluk · aktif üye (owner)",
  "apply.applicationsTitle": "Başvurularınız",
  "apply.formTitle": "Başvuru formu",
  "apply.formLede":
    "Onay sonrası Live Now yayın kimliğiniz bu bilgilerle eşlenir. İnceleme ekibi gönderdiğiniz metni görür.",
  "apply.typeLabel": "Başvuru türü",
  "apply.typeCreator": "Creator (bireysel)",
  "apply.typePublisher": "Publisher (kurumsal)",
  "apply.displayName": "Yayıncı adı",
  "apply.displayPlaceholder": "Görünen yayın adı",
  "apply.bio": "Kısa tanıtım",
  "apply.bioPlaceholder": "İzleyicilere kim olduğunuzu ve ne yayınladığınızı kısaca anlatın",
  "apply.company": "Şirket / kurum adı",
  "apply.submit": "Başvuruyu gönder",
  "apply.submitting": "Gönderiliyor…",
  "apply.nextTitle": "Nasıl ilerlersiniz",
  "apply.growFollowersTitle": "Takipçi yolunu büyütmek",
  "apply.growFollowersBody":
    "Aktif takipçi eşiğine {count} kişi kaldı. Pasif veya silinmiş hesaplar sayılmaz; sunucu aktif profil kurallarını uygular.",
  "apply.growCommunityTitle": "Topluluk yolunu büyütmek",
  "apply.growCommunityBodyNamed":
    "“{name}” için {count} aktif üye daha gerekir. Kurucu olsanız bile üyelik satırı ve aktif profil şarttır; topluluklar arası birleştirme yoktur.",
  "apply.growCommunityBodyDefault":
    "Sahip olduğunuz en büyük topluluk için {count} aktif üye daha gerekir. Kurucu olsanız bile üyelik satırı ve aktif profil şarttır; topluluklar arası birleştirme yoktur.",
  "apply.asideLabel": "Program özeti",
  "apply.afterKicker": "Onay sonrası",
  "apply.afterTitle": "Ne açılır?",
  "apply.afterBadge": "Creator / Publisher rozeti ve yayıncı profili",
  "apply.afterDiscovery": "Picom Live Now’da kamuya açık keşif görünürlüğü",
  "apply.afterGate": "Yayın başlatma kapısı (aktif rozet + onaylı başvuru)",
  "apply.afterSafety": "İnceleme ve güvenlik kurallarına bağlı yayın sürdürme",
  "apply.processKicker": "Süreç",
  "apply.processTitle": "Başvuru akışı",
  "apply.processStep1": "Eşiklerden birini tamamlayın",
  "apply.processStep2": "Başvuru formunu gönderin",
  "apply.processStep3": "İnceleme: uygunluk riski ve içerik politikası kontrolü",
  "apply.processStep4": "Onay → rozet; red / ek bilgi istenirse burada görünür",
  "apply.rulesKicker": "Sayım kuralları",
  "apply.rulesTitle": "Ne sayılır?",
  "apply.rulesFollowers": "Takipçi: {count} aktif takipçi",
  "apply.rulesCommunity": "Topluluk: sahip olduğunuz bir toplulukta {count} aktif üye",
  "apply.rulesOwner": "Owner kaynağı: communities.owner_id",
  "apply.rulesNoMerge": "Üye birleştirme yok · progress bar yetki değildir",
  "apply.elig.notEligible":
    "Henüz başvuru koşullarını karşılamıyorsunuz. Aşağıdaki yollardan birini tamamladığınızda form açılır.",
  "apply.elig.both": "Her iki başvuru kriterini de karşılıyorsunuz. Başvurunuzu gönderebilirsiniz.",
  "apply.elig.followers": "Takipçi kriterini karşıladınız. Creator / Publisher başvurusu yapabilirsiniz.",
  "apply.elig.community":
    "Topluluk kurucusu kriterini karşıladınız. Creator / Publisher başvurusu yapabilirsiniz.",
  "apply.elig.ok": "Başvuru koşulları karşılandı.",
  "apply.closer.tie": "İki yol da benzer uzaklıkta; hangisi size uygunsa onu büyütün.",
  "apply.closer.followers": "Şu an takipçi yolu sayısal olarak daha yakın.",
  "apply.closer.community": "Şu an sahip olduğunuz en büyük topluluk yolu daha yakın.",
  "apply.track.met": "Karşılandı",
  "apply.track.open": "Bu yol açık",
  "apply.track.remaining": "Kalan {count}",
  "apply.track.progressAria": "{label} ilerlemesi",
  "dash.title": "Publisher Dashboard",
  "dash.gatedBody": "Bu alana yalnızca onaylı Creator/Publisher hesapları erişebilir.",
  "dash.noBroadcast": "Hesabınız henüz yayın yetkisine sahip değil.",
  "dash.viewApplication": "Başvuru durumunu gör",
  "dash.fallbackName": "Yayıncı paneli",
  "dash.badgeActive": "Aktif rozet: {type}",
  "dash.badgeLoading": "Rozet durumu yükleniyor…",
  "dash.close": "Kapat",
  "dash.overviewTitle": "Genel bakış",
  "dash.overviewBody":
    "Canlı yayın başlatmak için Go Live kullanın. Live Now yalnızca public_discovery + onaylı rozetli yayınları listeler.",
  "dash.overviewBilling": "Gelir / abonelik / reklam: henüz yapılandırılmadı (billing provider yok).",
  "dash.scheduleTitle": "Yayın takvimi",
  "dash.scheduleEmpty": "Planlanmış yayın yok.",
  "dash.planTitle": "Yayın planla",
  "dash.planName": "Başlık",
  "dash.planStart": "Başlangıç",
  "dash.planSubmit": "Takvime ekle",
  "dash.settingsTitle": "Hesap doğrulama",
  "dash.accountKind": "Hesap türü: {kind}",
  "dash.profileStatus": "Profil durumu: {status}",
  "dash.applicationHistory": "Başvuru geçmişi",
  "review.lede":
    "Eşik karşılamak otomatik onay değildir. Snapshot ve güncel sayılar birlikte incelenir.",
  "review.filter.follower": "Takipçi kriteriyle",
  "review.filter.community": "Topluluk kriteriyle",
  "review.filter.both": "Her iki kriter",
  "review.filter.below": "Artık eşiğin altında",
  "review.filter.fraud": "Fraud incelemesi",
  "review.riskDrop": "Risk uyarısı: başvuru sonrası olağan dışı sayı düşüşü.",
  "review.empty": "Kuyruk boş.",
};

function pack(base: Catalog): Catalog {
  return { ...base };
}

export const PUBLISHER_PROGRAM_LOCALES: Readonly<Record<UiLanguage, Catalog>> = {
  en: pack(en),
  tr: pack(tr),
  de: pack(en),
  fr: pack(en),
  es: pack(en),
  it: pack(en),
  pt: pack(en),
  ru: pack(en),
  ar: pack(en),
  ja: pack(en),
};

export const PUBLISHER_PROGRAM_I18N_KEYS = Object.keys(en) as PublisherProgramI18nKey[];

export function translatePublisherProgram(
  key: PublisherProgramI18nKey,
  language: UiLanguage | string = "en",
  params: Record<string, string | number> = {},
): string {
  const locale = normalizeUiLanguage(language);
  const template = PUBLISHER_PROGRAM_LOCALES[locale][key];
  if (typeof template !== "string" || !template.trim()) {
    throw new Error(`Missing publisher program i18n key ${key} for locale ${locale}`);
  }
  return template.replace(/\{(\w+)\}/g, (_match, name: string) => String(params[name] ?? ""));
}

export function formatPublisherCount(value: number, language: UiLanguage | string = "en"): string {
  return value.toLocaleString(getUiLanguageBcp47(normalizeUiLanguage(language)));
}

export function assertPublisherProgramLocaleParity(): { ok: true } | { ok: false; detail: string } {
  const enKeys = Object.keys(PUBLISHER_PROGRAM_LOCALES.en).sort();
  for (const locale of SUPPORTED_UI_LANGUAGES) {
    const keys = Object.keys(PUBLISHER_PROGRAM_LOCALES[locale]).sort();
    if (keys.length !== enKeys.length || keys.some((k, i) => k !== enKeys[i])) {
      return { ok: false, detail: `${locale} key set mismatch` };
    }
    for (const key of enKeys) {
      const value = PUBLISHER_PROGRAM_LOCALES[locale][key as PublisherProgramI18nKey];
      if (typeof value !== "string" || !value.trim()) {
        return { ok: false, detail: `${locale}.${key} empty` };
      }
    }
  }
  return { ok: true };
}
