import { SUPPORTED_UI_LANGUAGES, normalizeUiLanguage, type UiLanguage } from "./uiLanguages.ts";

type Catalog = Record<string, string>;

const en: Catalog = {
  "earnings.title": "Earnings",
  "earnings.overview": "Overview",
  "earnings.subscriptions": "Subscriptions",
  "earnings.donations": "Donations",
  "earnings.adRevenue": "Ad revenue",
  "earnings.transactions": "Transactions",
  "earnings.monetization": "Monetization",
  "earnings.subscriptionTier": "Subscription tiers",
  "earnings.monthly": "Monthly",
  "earnings.yearly": "Yearly",
  "earnings.tips": "Tips",
  "earnings.grossRevenue": "Gross revenue",
  "earnings.netRevenue": "Net revenue",
  "earnings.platformFee": "Platform fee",
  "earnings.providerFee": "Provider fee",
  "earnings.pendingBalance": "Pending balance",
  "earnings.availableBalance": "Available balance",
  "earnings.paidOut": "Paid out",
  "earnings.refund": "Refund",
  "earnings.chargeback": "Chargeback",
  "earnings.currency": "Currency",
  "earnings.paymentPending": "Payment pending",
  "earnings.paymentFailed": "Payment failed",
  "earnings.monetizationUnavailable": "Monetization is currently unavailable.",
  "earnings.payoutsUnavailable": "Payouts not yet available",
  "earnings.payoutSetupUnavailable": "Payout setup not available yet",
  "earnings.anonymous": "Anonymous",
  "earnings.subscriber": "Subscriber",
  "earnings.activeSubscribers": "Active subscribers",
  "earnings.revenueBreakdown": "Revenue breakdown",
  "earnings.empty": "No earnings yet.",
  "earnings.loadError": "Unable to load earnings.",
  "earnings.tableFallback": "Revenue table",
  "earnings.filters": "Transaction filters",
  "earnings.source": "Source",
  "earnings.status": "Status",
  "earnings.date": "Date",
  "earnings.gross": "Gross",
  "earnings.fees": "Fees",
  "earnings.net": "Net",
  "earnings.aria": "Publisher earnings dashboard",
  "finance.identityVerification": "Identity verification",
  "finance.kyc": "KYC",
  "finance.verificationRequired": "Verification required",
  "finance.verificationPending": "Verification pending",
  "finance.verificationVerified": "Verified",
  "finance.verificationRestricted": "Restricted",
  "finance.taxProfile": "Tax profile",
  "finance.taxStatus": "Tax status",
  "finance.payouts": "Payouts",
  "finance.payoutAccount": "Payout account",
  "finance.addPayoutAccount": "Add payout account",
  "finance.payoutUnavailable": "Payouts unavailable",
  "finance.payoutOnHold": "Payouts on hold",
  "finance.availableForPayout": "Available for payout",
  "finance.requestPayout": "Request payout",
  "finance.minimumPayout": "Minimum payout",
  "finance.payoutPending": "Payout pending",
  "finance.payoutProcessing": "Payout processing",
  "finance.payoutPaid": "Payout paid",
  "finance.payoutFailed": "Payout failed",
  "finance.payoutReversed": "Payout reversed",
  "finance.statements": "Statements",
  "finance.earningsStatement": "Earnings statement",
  "finance.financeSetup": "Finance setup",
  "finance.additionalInformationRequired": "Additional information required",
  "finance.setup": "Setup",
  "finance.notStarted": "Not started",
  "finance.providerUnavailable": "Provider onboarding is currently unavailable.",
};

const tr: Catalog = {
  ...en,
  "earnings.title": "Kazançlar",
  "earnings.overview": "Genel bakış",
  "earnings.subscriptions": "Abonelikler",
  "earnings.donations": "Bağışlar",
  "earnings.adRevenue": "Reklam geliri",
  "earnings.transactions": "İşlemler",
  "earnings.pendingBalance": "Bekleyen bakiye",
  "earnings.availableBalance": "Kullanılabilir bakiye",
  "earnings.paidOut": "Ödenen",
  "earnings.payoutsUnavailable": "Ödemeler henüz kullanılamıyor",
  "earnings.monetizationUnavailable": "Para kazanma şu anda kullanılamıyor.",
  "earnings.anonymous": "Anonim",
  "earnings.revenueBreakdown": "Gelir dökümü",
  "finance.payouts": "Ödemeler",
  "finance.statements": "Ekstreler",
  "finance.financeSetup": "Finans kurulumu",
  "finance.identityVerification": "Kimlik doğrulama",
  "finance.payoutOnHold": "Ödemeler beklemeye alındı",
  "finance.payoutUnavailable": "Ödemeler kullanılamıyor",
};

const de: Catalog = {
  ...en,
  "earnings.title": "Einnahmen",
  "earnings.pendingBalance": "Ausstehendes Guthaben",
  "earnings.availableBalance": "Verfügbares Guthaben",
  "earnings.payoutsUnavailable": "Auszahlungen noch nicht verfügbar",
  "earnings.donations": "Spenden",
  "earnings.adRevenue": "Werbeeinnahmen",
  "finance.payouts": "Auszahlungen",
  "finance.statements": "Abrechnungen",
  "finance.identityVerification": "Identitätsprüfung",
};

const fr: Catalog = {
  ...en,
  "earnings.title": "Revenus",
  "earnings.pendingBalance": "Solde en attente",
  "earnings.availableBalance": "Solde disponible",
  "earnings.payoutsUnavailable": "Paiements pas encore disponibles",
  "earnings.donations": "Dons",
  "earnings.adRevenue": "Revenus publicitaires",
  "finance.payouts": "Paiements",
  "finance.statements": "Relevés",
  "finance.identityVerification": "Vérification d'identité",
};

const es: Catalog = {
  ...en,
  "earnings.title": "Ingresos",
  "earnings.pendingBalance": "Saldo pendiente",
  "earnings.availableBalance": "Saldo disponible",
  "earnings.payoutsUnavailable": "Los pagos aún no están disponibles",
  "earnings.donations": "Donaciones",
  "earnings.adRevenue": "Ingresos por anuncios",
  "finance.payouts": "Pagos",
  "finance.statements": "Extractos",
  "finance.identityVerification": "Verificación de identidad",
};

const it: Catalog = {
  ...en,
  "earnings.title": "Guadagni",
  "earnings.pendingBalance": "Saldo in sospeso",
  "earnings.availableBalance": "Saldo disponibile",
  "earnings.payoutsUnavailable": "Pagamenti non ancora disponibili",
  "earnings.donations": "Donazioni",
  "earnings.adRevenue": "Ricavi pubblicitari",
  "finance.payouts": "Pagamenti",
  "finance.statements": "Estratti",
  "finance.identityVerification": "Verifica identità",
};

const pt: Catalog = {
  ...en,
  "earnings.title": "Ganhos",
  "earnings.pendingBalance": "Saldo pendente",
  "earnings.availableBalance": "Saldo disponível",
  "earnings.payoutsUnavailable": "Pagamentos ainda não disponíveis",
  "earnings.donations": "Doações",
  "earnings.adRevenue": "Receita de anúncios",
  "finance.payouts": "Pagamentos",
  "finance.statements": "Extratos",
  "finance.identityVerification": "Verificação de identidade",
};

const ru: Catalog = {
  ...en,
  "earnings.title": "Доходы",
  "earnings.pendingBalance": "Ожидающий баланс",
  "earnings.availableBalance": "Доступный баланс",
  "earnings.payoutsUnavailable": "Выплаты пока недоступны",
  "earnings.donations": "Донаты",
  "earnings.adRevenue": "Доход от рекламы",
  "finance.payouts": "Выплаты",
  "finance.statements": "Выписки",
  "finance.identityVerification": "Проверка личности",
};

const ar: Catalog = {
  ...en,
  "earnings.title": "الأرباح",
  "earnings.overview": "نظرة عامة",
  "earnings.subscriptions": "الاشتراكات",
  "earnings.donations": "التبرعات",
  "earnings.adRevenue": "إيرادات الإعلانات",
  "earnings.transactions": "المعاملات",
  "earnings.pendingBalance": "الرصيد المعلق",
  "earnings.availableBalance": "الرصيد المتاح",
  "earnings.paidOut": "المدفوع",
  "earnings.payoutsUnavailable": "المدفوعات غير متاحة بعد",
  "earnings.monetizationUnavailable": "تحقيق الدخل غير متاح حاليًا.",
  "earnings.anonymous": "مجهول",
  "earnings.revenueBreakdown": "تفصيل الإيرادات",
  "earnings.activeSubscribers": "المشتركون النشطون",
  "finance.payouts": "المدفوعات",
  "finance.statements": "الكشوفات",
  "finance.financeSetup": "إعداد المالية",
  "finance.identityVerification": "التحقق من الهوية",
  "finance.payoutOnHold": "المدفوعات معلّقة",
  "finance.payoutUnavailable": "المدفوعات غير متاحة",
  "finance.additionalInformationRequired": "مطلوب معلومات إضافية",
};

const ja: Catalog = {
  ...en,
  "earnings.title": "収益",
  "earnings.pendingBalance": "保留中の残高",
  "earnings.availableBalance": "利用可能残高",
  "earnings.payoutsUnavailable": "支払い機能はまだ利用できません",
  "earnings.donations": "寄付",
  "earnings.adRevenue": "広告収益",
  "finance.payouts": "支払い",
  "finance.statements": "明細書",
  "finance.identityVerification": "本人確認",
};

const CATALOGS: Record<UiLanguage, Catalog> = { en, tr, de, fr, es, it, pt, ru, ar, ja };

export type PublisherMonetizationI18nKey = keyof typeof en;

export function translatePublisherMonetization(key: string, locale: string): string {
  const lang = normalizeUiLanguage(locale);
  const catalog = CATALOGS[lang] ?? en;
  return catalog[key] ?? en[key] ?? key;
}

export function publisherMonetizationCatalogLocales(): readonly UiLanguage[] {
  return SUPPORTED_UI_LANGUAGES;
}

export function publisherMonetizationCatalogKeys(): readonly string[] {
  return Object.keys(en);
}
