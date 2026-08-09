import type { UiLanguage } from "./uiLanguages";

const EN = {
  "studio.title": "Creator Studio",
  "studio.overview": "Overview",
  "studio.content": "Content",
  "studio.audience": "Audience",
  "studio.earnings": "Earnings",
  "studio.team": "Team",
  "studio.teamMembers": "Team members",
  "studio.inviteMember": "Invite member",
  "studio.roles": "Roles",
  "studio.permissions": "Permissions",
  "studio.manager": "Manager",
  "studio.streamManager": "Stream manager",
  "studio.analyst": "Analyst",
  "studio.financeManager": "Finance manager",
  "studio.securityCenter": "Security center",
  "studio.activeSessions": "Active sessions",
  "studio.activityLog": "Activity log",
  "studio.sensitiveAction": "Sensitive action",
  "studio.sessionRevoked": "Session revoked",
  "studio.roleChanged": "Role changed",
  "studio.invitePending": "Invite pending",
  "studio.inviteExpired": "Invite expired",
  "studio.noPermission": "No permission",
  "studio.setupRequired": "Setup required",
  "studio.featureUnavailable": "Feature unavailable",
  "studio.providerNotConfigured": "Provider not configured",
  "studio.financeAccess": "Finance access",
  "studio.securityAccess": "Security access",
  "studio.community": "Community",
  "studio.settings": "Settings",
  "studio.support": "Support",
  "studio.readiness": "Readiness",
  "studio.loading": "Loading Creator Studio…",
  "studio.unavailable": "Creator Studio is unavailable.",
  "studio.legacyDashboard": "Classic publisher dashboard",
  "studio.refreshPermissions": "Refresh permissions",
  "studio.confirmRemoveMember": "Remove this team member?",
  "studio.financeWarning": "Finance permissions grant access to earnings and payout controls. Grant carefully.",
  "studio.sessionsPartial": "Device sessions shown for your account only. Full Auth session enumeration is provider-limited.",
  "studio.reauthPartial": "Recent-auth uses Auth session age when available; MFA step-up is not claimed certified.",
} as const;

export type CreatorStudioI18nKey = keyof typeof EN;

const TR: Record<CreatorStudioI18nKey, string> = {
  "studio.title": "Creator Studio",
  "studio.overview": "Genel bakış",
  "studio.content": "İçerik",
  "studio.audience": "Kitle",
  "studio.earnings": "Kazançlar",
  "studio.team": "Ekip",
  "studio.teamMembers": "Ekip üyeleri",
  "studio.inviteMember": "Üye davet et",
  "studio.roles": "Roller",
  "studio.permissions": "İzinler",
  "studio.manager": "Yönetici",
  "studio.streamManager": "Yayın yöneticisi",
  "studio.analyst": "Analist",
  "studio.financeManager": "Finans yöneticisi",
  "studio.securityCenter": "Güvenlik merkezi",
  "studio.activeSessions": "Aktif oturumlar",
  "studio.activityLog": "Aktivite kaydı",
  "studio.sensitiveAction": "Hassas işlem",
  "studio.sessionRevoked": "Oturum iptal edildi",
  "studio.roleChanged": "Rol değişti",
  "studio.invitePending": "Davet bekliyor",
  "studio.inviteExpired": "Davet süresi doldu",
  "studio.noPermission": "İzin yok",
  "studio.setupRequired": "Kurulum gerekli",
  "studio.featureUnavailable": "Özellik kullanılamıyor",
  "studio.providerNotConfigured": "Sağlayıcı yapılandırılmadı",
  "studio.financeAccess": "Finans erişimi",
  "studio.securityAccess": "Güvenlik erişimi",
  "studio.community": "Topluluk",
  "studio.settings": "Ayarlar",
  "studio.support": "Destek",
  "studio.readiness": "Hazırlık",
  "studio.loading": "Creator Studio yükleniyor…",
  "studio.unavailable": "Creator Studio kullanılamıyor.",
  "studio.legacyDashboard": "Klasik yayıncı paneli",
  "studio.refreshPermissions": "İzinleri yenile",
  "studio.confirmRemoveMember": "Bu ekip üyesi kaldırılsın mı?",
  "studio.financeWarning": "Finans izinleri kazanç ve ödeme kontrollerine erişim verir. Dikkatli verin.",
  "studio.sessionsPartial": "Cihaz oturumları yalnızca kendi hesabınız için gösterilir.",
  "studio.reauthPartial": "Yakın kimlik doğrulama, mevcut Auth oturum yaşına dayanır; MFA GO iddia edilmez.",
};

function clone(map: Record<CreatorStudioI18nKey, string>): Record<CreatorStudioI18nKey, string> {
  return { ...map };
}

const DE = clone(EN as unknown as Record<CreatorStudioI18nKey, string>);
DE["studio.title"] = "Creator Studio";
DE["studio.overview"] = "Übersicht";
DE["studio.team"] = "Team";
DE["studio.securityCenter"] = "Sicherheitscenter";
DE["studio.noPermission"] = "Keine Berechtigung";
DE["studio.setupRequired"] = "Einrichtung erforderlich";
DE["studio.featureUnavailable"] = "Funktion nicht verfügbar";
DE["studio.providerNotConfigured"] = "Anbieter nicht konfiguriert";

const FR = clone(EN as unknown as Record<CreatorStudioI18nKey, string>);
FR["studio.overview"] = "Aperçu";
FR["studio.team"] = "Équipe";
FR["studio.securityCenter"] = "Centre de sécurité";
FR["studio.noPermission"] = "Aucune autorisation";
FR["studio.setupRequired"] = "Configuration requise";
FR["studio.featureUnavailable"] = "Fonctionnalité indisponible";
FR["studio.providerNotConfigured"] = "Fournisseur non configuré";

const ES = clone(EN as unknown as Record<CreatorStudioI18nKey, string>);
ES["studio.overview"] = "Resumen";
ES["studio.team"] = "Equipo";
ES["studio.securityCenter"] = "Centro de seguridad";
ES["studio.noPermission"] = "Sin permiso";
ES["studio.setupRequired"] = "Configuración requerida";
ES["studio.featureUnavailable"] = "Función no disponible";
ES["studio.providerNotConfigured"] = "Proveedor no configurado";

const IT = clone(EN as unknown as Record<CreatorStudioI18nKey, string>);
IT["studio.overview"] = "Panoramica";
IT["studio.team"] = "Team";
IT["studio.securityCenter"] = "Centro sicurezza";
IT["studio.noPermission"] = "Nessun permesso";
IT["studio.setupRequired"] = "Configurazione richiesta";
IT["studio.featureUnavailable"] = "Funzione non disponibile";
IT["studio.providerNotConfigured"] = "Provider non configurato";

const PT = clone(EN as unknown as Record<CreatorStudioI18nKey, string>);
PT["studio.overview"] = "Visão geral";
PT["studio.team"] = "Equipe";
PT["studio.securityCenter"] = "Centro de segurança";
PT["studio.noPermission"] = "Sem permissão";
PT["studio.setupRequired"] = "Configuração necessária";
PT["studio.featureUnavailable"] = "Recurso indisponível";
PT["studio.providerNotConfigured"] = "Provedor não configurado";

const RU = clone(EN as unknown as Record<CreatorStudioI18nKey, string>);
RU["studio.overview"] = "Обзор";
RU["studio.team"] = "Команда";
RU["studio.securityCenter"] = "Центр безопасности";
RU["studio.noPermission"] = "Нет доступа";
RU["studio.setupRequired"] = "Требуется настройка";
RU["studio.featureUnavailable"] = "Функция недоступна";
RU["studio.providerNotConfigured"] = "Провайдер не настроен";

const AR: Record<CreatorStudioI18nKey, string> = {
  ...EN,
  "studio.title": "استوديو المنشئ",
  "studio.overview": "نظرة عامة",
  "studio.content": "المحتوى",
  "studio.audience": "الجمهور",
  "studio.earnings": "الأرباح",
  "studio.team": "الفريق",
  "studio.teamMembers": "أعضاء الفريق",
  "studio.inviteMember": "دعوة عضو",
  "studio.roles": "الأدوار",
  "studio.permissions": "الصلاحيات",
  "studio.manager": "مدير",
  "studio.streamManager": "مدير البث",
  "studio.analyst": "محلل",
  "studio.financeManager": "مدير مالي",
  "studio.securityCenter": "مركز الأمان",
  "studio.activeSessions": "الجلسات النشطة",
  "studio.activityLog": "سجل النشاط",
  "studio.sensitiveAction": "إجراء حساس",
  "studio.sessionRevoked": "تم إلغاء الجلسة",
  "studio.roleChanged": "تم تغيير الدور",
  "studio.invitePending": "دعوة قيد الانتظار",
  "studio.inviteExpired": "انتهت الدعوة",
  "studio.noPermission": "لا توجد صلاحية",
  "studio.setupRequired": "الإعداد مطلوب",
  "studio.featureUnavailable": "الميزة غير متاحة",
  "studio.providerNotConfigured": "المزوّد غير مُعدّ",
  "studio.financeAccess": "الوصول المالي",
  "studio.securityAccess": "وصول الأمان",
  "studio.community": "المجتمع",
  "studio.settings": "الإعدادات",
  "studio.support": "الدعم",
  "studio.readiness": "الجاهزية",
  "studio.loading": "جارٍ تحميل استوديو المنشئ…",
  "studio.unavailable": "استوديو المنشئ غير متاح.",
  "studio.legacyDashboard": "لوحة الناشر الكلاسيكية",
  "studio.refreshPermissions": "تحديث الصلاحيات",
  "studio.confirmRemoveMember": "إزالة عضو الفريق؟",
  "studio.financeWarning": "صلاحيات المالية تمنح الوصول للأرباح والمدفوعات. امنحها بحذر.",
  "studio.sessionsPartial": "جلسات الأجهزة تُعرض لحسابك فقط.",
  "studio.reauthPartial": "إعادة المصادقة تعتمد على عمر جلسة Auth عند التوفر.",
};

const JA = clone(EN as unknown as Record<CreatorStudioI18nKey, string>);
JA["studio.overview"] = "概要";
JA["studio.team"] = "チーム";
JA["studio.securityCenter"] = "セキュリティセンター";
JA["studio.noPermission"] = "権限がありません";
JA["studio.setupRequired"] = "セットアップが必要です";
JA["studio.featureUnavailable"] = "機能は利用できません";
JA["studio.providerNotConfigured"] = "プロバイダー未設定";

const CATALOGS: Record<UiLanguage, Record<CreatorStudioI18nKey, string>> = {
  en: EN as unknown as Record<CreatorStudioI18nKey, string>,
  tr: TR,
  de: DE,
  fr: FR,
  es: ES,
  it: IT,
  pt: PT,
  ru: RU,
  ar: AR,
  ja: JA,
};

export function translateCreatorStudio(key: CreatorStudioI18nKey, language: UiLanguage): string {
  return CATALOGS[language]?.[key] ?? EN[key] ?? key;
}
