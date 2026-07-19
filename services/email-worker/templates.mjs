import { assertSafeActionUrl, escapeHtml, sanitizeTemplateText } from "./emailPolicy.mjs";

export const SUPPORTED_EMAIL_LOCALES = Object.freeze(["tr", "en", "de", "fr", "es", "it", "pt", "ru", "ar", "ja"]);

export const TEMPLATE_CATEGORY = Object.freeze({
  welcome: "required_account_security", support_ticket_received: "support_updates", support_internal_contact: "support_updates",
  support_reply: "support_updates", support_ticket_closed: "support_updates", account_warning: "required_account_security",
  suspension_notice: "required_account_security", appeal_received: "support_updates", appeal_decision: "required_account_security",
  community_ownership_transfer: "community_updates", community_invitation: "community_updates", content_removal: "required_account_security",
  temporary_restriction: "required_account_security", community_quarantine: "community_updates", security_alert: "required_account_security",
  new_login: "required_account_security", security_settings_changed: "required_account_security", subscription_confirmation: "billing",
  payment_failure: "billing", refund_status: "billing", incident_status: "product_announcements", optional_digest: "optional_digest",
  radio_podcast_update: "radio_podcast_updates", product_announcement: "product_announcements", marketing_announcement: "marketing_advertising",
});

const LABELS = {
  en: { hello: "Hello", details: "Details", action: "Open Picom", security: "If you did not request this, secure your account immediately.", footer: "Picom account and community service", ignore: "Never share passwords, verification codes, or recovery secrets by email." },
  tr: { hello: "Merhaba", details: "Ayrıntılar", action: "Picom'u aç", security: "Bu işlemi siz yapmadıysanız hesabınızı hemen güvene alın.", footer: "Picom hesap ve topluluk hizmeti", ignore: "Parolaları, doğrulama kodlarını veya kurtarma sırlarını e-postayla paylaşmayın." },
  de: { hello: "Hallo", details: "Details", action: "Picom öffnen", security: "Wenn Sie dies nicht angefordert haben, sichern Sie sofort Ihr Konto.", footer: "Picom Konto- und Community-Dienst", ignore: "Teilen Sie niemals Passwörter, Bestätigungscodes oder Wiederherstellungsdaten per E-Mail." },
  fr: { hello: "Bonjour", details: "Détails", action: "Ouvrir Picom", security: "Si vous n'êtes pas à l'origine de cette action, sécurisez immédiatement votre compte.", footer: "Service de compte et de communauté Picom", ignore: "Ne partagez jamais de mots de passe, codes ou secrets de récupération par e-mail." },
  es: { hello: "Hola", details: "Detalles", action: "Abrir Picom", security: "Si no solicitaste esta acción, protege tu cuenta de inmediato.", footer: "Servicio de cuenta y comunidad de Picom", ignore: "Nunca compartas contraseñas, códigos o secretos de recuperación por correo." },
  it: { hello: "Ciao", details: "Dettagli", action: "Apri Picom", security: "Se non hai richiesto questa azione, proteggi subito il tuo account.", footer: "Servizio account e community Picom", ignore: "Non condividere mai password, codici o segreti di recupero via email." },
  pt: { hello: "Olá", details: "Detalhes", action: "Abrir Picom", security: "Se não solicitou esta ação, proteja a sua conta imediatamente.", footer: "Serviço de conta e comunidade Picom", ignore: "Nunca partilhe palavras-passe, códigos ou segredos de recuperação por email." },
  ru: { hello: "Здравствуйте", details: "Подробности", action: "Открыть Picom", security: "Если это действие выполнили не вы, немедленно защитите аккаунт.", footer: "Служба аккаунтов и сообществ Picom", ignore: "Никогда не сообщайте пароли, коды или данные восстановления по электронной почте." },
  ar: { hello: "مرحباً", details: "التفاصيل", action: "فتح Picom", security: "إذا لم تطلب هذا الإجراء، فأمّن حسابك فوراً.", footer: "خدمة حسابات ومجتمعات Picom", ignore: "لا تشارك كلمات المرور أو رموز التحقق أو أسرار الاسترداد عبر البريد." },
  ja: { hello: "こんにちは", details: "詳細", action: "Picomを開く", security: "心当たりがない場合は、直ちにアカウントを保護してください。", footer: "Picom アカウント・コミュニティサービス", ignore: "パスワード、確認コード、復旧情報をメールで共有しないでください。" },
};

const SUBJECTS = {
  en: ["Welcome to Picom","We received your support request","New Picom contact request","Support replied to your request","Your support request was closed","Important account warning","Your Picom account was suspended","We received your appeal","A decision was made on your appeal","Community ownership changed","You were invited to a Picom community","Content moderation action","Temporary account restriction","Community status update","Picom security alert","New sign-in to Picom","Security settings changed","Subscription confirmed","Payment action required","Refund status updated","Picom service update","Your Picom digest","New radio or podcast update","What's new in Picom","Picom update"],
  tr: ["Picom'a hoş geldiniz","Destek talebinizi aldık","Yeni Picom iletişim talebi","Destek talebiniz yanıtlandı","Destek talebiniz kapatıldı","Önemli hesap uyarısı","Picom hesabınız askıya alındı","İtirazınızı aldık","İtirazınız sonuçlandı","Topluluk sahipliği değişti","Bir Picom topluluğuna davet edildiniz","İçerik moderasyon işlemi","Geçici hesap kısıtlaması","Topluluk durum güncellemesi","Picom güvenlik uyarısı","Picom hesabınıza yeni giriş","Güvenlik ayarları değişti","Abonelik onaylandı","Ödeme işlemi gerekli","İade durumu güncellendi","Picom hizmet güncellemesi","Picom özetiniz","Yeni radyo veya podcast güncellemesi","Picom'daki yenilikler","Picom güncellemesi"],
  de: ["Willkommen bei Picom","Wir haben Ihre Supportanfrage erhalten","Neue Picom-Kontaktanfrage","Antwort auf Ihre Supportanfrage","Ihre Supportanfrage wurde geschlossen","Wichtige Kontowarnung","Ihr Picom-Konto wurde gesperrt","Wir haben Ihren Einspruch erhalten","Entscheidung zu Ihrem Einspruch","Community-Inhaberschaft geändert","Einladung zu einer Picom-Community","Moderationsmaßnahme","Vorübergehende Kontoeinschränkung","Community-Statusupdate","Picom-Sicherheitswarnung","Neue Anmeldung bei Picom","Sicherheitseinstellungen geändert","Abonnement bestätigt","Zahlungsaktion erforderlich","Erstattungsstatus aktualisiert","Picom-Serviceupdate","Ihre Picom-Zusammenfassung","Neues Radio- oder Podcast-Update","Neuigkeiten bei Picom","Picom-Update"],
  fr: ["Bienvenue sur Picom","Nous avons reçu votre demande d'assistance","Nouvelle demande de contact Picom","Réponse à votre demande d'assistance","Votre demande d'assistance est close","Avertissement important concernant le compte","Votre compte Picom a été suspendu","Nous avons reçu votre recours","Décision concernant votre recours","Changement de propriétaire de communauté","Invitation à une communauté Picom","Action de modération de contenu","Restriction temporaire du compte","Mise à jour de la communauté","Alerte de sécurité Picom","Nouvelle connexion à Picom","Paramètres de sécurité modifiés","Abonnement confirmé","Action de paiement requise","Statut du remboursement mis à jour","Mise à jour du service Picom","Votre résumé Picom","Nouvelle mise à jour radio ou podcast","Nouveautés de Picom","Mise à jour Picom"],
  es: ["Te damos la bienvenida a Picom","Recibimos tu solicitud de soporte","Nueva solicitud de contacto de Picom","Soporte respondió a tu solicitud","Tu solicitud de soporte se cerró","Advertencia importante de la cuenta","Tu cuenta de Picom fue suspendida","Recibimos tu apelación","Decisión sobre tu apelación","Cambió la propiedad de la comunidad","Invitación a una comunidad de Picom","Acción de moderación de contenido","Restricción temporal de la cuenta","Actualización del estado de la comunidad","Alerta de seguridad de Picom","Nuevo inicio de sesión en Picom","Cambió la configuración de seguridad","Suscripción confirmada","Se requiere una acción de pago","Estado del reembolso actualizado","Actualización del servicio de Picom","Tu resumen de Picom","Nueva actualización de radio o pódcast","Novedades de Picom","Actualización de Picom"],
  it: ["Benvenuto su Picom","Abbiamo ricevuto la tua richiesta di supporto","Nuova richiesta di contatto Picom","Il supporto ha risposto","La richiesta di supporto è stata chiusa","Avviso importante sull'account","Il tuo account Picom è stato sospeso","Abbiamo ricevuto il tuo ricorso","Decisione sul tuo ricorso","Proprietà della community modificata","Invito a una community Picom","Azione di moderazione dei contenuti","Limitazione temporanea dell'account","Aggiornamento stato community","Avviso di sicurezza Picom","Nuovo accesso a Picom","Impostazioni di sicurezza modificate","Abbonamento confermato","Azione di pagamento richiesta","Stato del rimborso aggiornato","Aggiornamento del servizio Picom","Il tuo riepilogo Picom","Nuovo aggiornamento radio o podcast","Novità su Picom","Aggiornamento Picom"],
  pt: ["Bem-vindo ao Picom","Recebemos o seu pedido de suporte","Novo pedido de contacto Picom","O suporte respondeu ao seu pedido","O seu pedido de suporte foi encerrado","Aviso importante da conta","A sua conta Picom foi suspensa","Recebemos o seu recurso","Decisão sobre o seu recurso","A propriedade da comunidade mudou","Convite para uma comunidade Picom","Ação de moderação de conteúdo","Restrição temporária da conta","Atualização do estado da comunidade","Alerta de segurança Picom","Novo início de sessão no Picom","Definições de segurança alteradas","Subscrição confirmada","Ação de pagamento necessária","Estado do reembolso atualizado","Atualização do serviço Picom","O seu resumo Picom","Nova atualização de rádio ou podcast","Novidades no Picom","Atualização Picom"],
  ru: ["Добро пожаловать в Picom","Мы получили ваш запрос в поддержку","Новый запрос Picom","Поддержка ответила на запрос","Запрос в поддержку закрыт","Важное предупреждение аккаунта","Ваш аккаунт Picom приостановлен","Мы получили вашу апелляцию","Решение по апелляции","Владелец сообщества изменён","Приглашение в сообщество Picom","Модерация контента","Временное ограничение аккаунта","Обновление статуса сообщества","Предупреждение безопасности Picom","Новый вход в Picom","Настройки безопасности изменены","Подписка подтверждена","Требуется действие с платежом","Статус возврата обновлён","Обновление сервиса Picom","Ваша сводка Picom","Обновление радио или подкаста","Новое в Picom","Обновление Picom"],
  ar: ["مرحباً بك في Picom","استلمنا طلب الدعم","طلب تواصل جديد في Picom","رد فريق الدعم على طلبك","تم إغلاق طلب الدعم","تحذير مهم للحساب","تم تعليق حساب Picom","استلمنا طلب الاستئناف","صدر قرار بشأن الاستئناف","تغيّرت ملكية المجتمع","دعوة إلى مجتمع Picom","إجراء إشراف على المحتوى","تقييد مؤقت للحساب","تحديث حالة المجتمع","تنبيه أمني من Picom","تسجيل دخول جديد إلى Picom","تم تغيير إعدادات الأمان","تم تأكيد الاشتراك","يلزم إجراء للدفع","تم تحديث حالة الاسترداد","تحديث خدمة Picom","ملخص Picom","تحديث جديد للراديو أو البودكاست","الجديد في Picom","تحديث Picom"],
  ja: ["Picomへようこそ","サポート依頼を受け付けました","Picomへの新しいお問い合わせ","サポートから返信があります","サポート依頼を終了しました","重要なアカウント警告","Picomアカウントが停止されました","異議申し立てを受け付けました","異議申し立ての結果","コミュニティ所有者が変更されました","Picomコミュニティへの招待","コンテンツのモデレーション措置","一時的なアカウント制限","コミュニティ状態の更新","Picomセキュリティ警告","Picomへの新しいログイン","セキュリティ設定が変更されました","サブスクリプションを確認しました","お支払いの対応が必要です","返金状況が更新されました","Picomサービス更新","Picomダイジェスト","ラジオ・ポッドキャストの更新","Picomの新着情報","Picom更新"],
};

const TEMPLATE_IDS = Object.keys(TEMPLATE_CATEGORY);
const subjectMaps = Object.fromEntries(Object.entries(SUBJECTS).map(([locale, values]) => [locale, Object.fromEntries(TEMPLATE_IDS.map((id, index) => [id, values[index] ?? SUBJECTS.en[index]]))]));

function localeOrFallback(value) { return SUPPORTED_EMAIL_LOCALES.includes(value) ? value : "en"; }

export function renderEmailTemplate(templateId, locale, parameters = {}, unsubscribeUrl = null) {
  if (!(templateId in TEMPLATE_CATEGORY)) throw new Error("EMAIL_TEMPLATE_NOT_ALLOWED");
  const resolvedLocale = localeOrFallback(locale);
  const copy = LABELS[resolvedLocale];
  const direction = resolvedLocale === "ar" ? "rtl" : "ltr";
  const displayName = sanitizeTemplateText(parameters.displayName || "Picom member", 80);
  const summary = sanitizeTemplateText(parameters.summary || copy.details, 1200);
  const reference = sanitizeTemplateText(parameters.reference, 120);
  const actionUrl = assertSafeActionUrl(parameters.actionUrl);
  const actionLabel = sanitizeTemplateText(parameters.actionLabel || copy.action, 80);
  const subject = subjectMaps[resolvedLocale][templateId];
  const securityNote = TEMPLATE_CATEGORY[templateId] === "required_account_security" ? copy.security : copy.ignore;
  const textLines = [`${copy.hello} ${displayName},`, "", summary];
  if (reference) textLines.push("", `${copy.details}: ${reference}`);
  if (actionUrl) textLines.push("", `${actionLabel}: ${actionUrl}`);
  textLines.push("", securityNote, "", `${copy.footer} · info@picom.gg`);
  if (unsubscribeUrl) textLines.push("", `Unsubscribe: ${unsubscribeUrl}`);

  const button = actionUrl ? `<tr><td style="padding:8px 30px 24px"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;border-radius:10px;background:#087f79;color:#fff;text-decoration:none;padding:12px 20px;font-weight:700">${escapeHtml(actionLabel)}</a></td></tr>` : "";
  const unsubscribe = unsubscribeUrl ? `<p style="margin:12px 0 0;font-size:11px"><a href="${escapeHtml(unsubscribeUrl)}" style="color:#65747f">Unsubscribe from optional email</a></p>` : "";
  const html = `<!doctype html><html lang="${resolvedLocale}" dir="${direction}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#edf2f4;color:#172127;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="560" style="max-width:560px;width:100%;background:#fff;border:1px solid #d9e3e6;border-radius:18px;overflow:hidden"><tr><td style="padding:22px 30px;background:#073f3d;color:#fff;font-size:22px;font-weight:800">Picom</td></tr><tr><td style="padding:30px 30px 10px"><h1 style="margin:0 0 16px;font-size:22px">${escapeHtml(subject)}</h1><p style="margin:0 0 14px;line-height:1.6">${escapeHtml(copy.hello)} ${escapeHtml(displayName)},</p><p style="margin:0 0 14px;line-height:1.6;color:#42545d">${escapeHtml(summary)}</p>${reference ? `<p style="margin:0 0 14px;color:#42545d"><strong>${escapeHtml(copy.details)}:</strong> ${escapeHtml(reference)}</p>` : ""}</td></tr>${button}<tr><td style="padding:18px 30px;background:#f7f9fa;border-top:1px solid #e4eaec;color:#65747f;font-size:12px;line-height:1.5"><p style="margin:0">${escapeHtml(securityNote)}</p><p style="margin:10px 0 0">${escapeHtml(copy.footer)} · info@picom.gg</p>${unsubscribe}</td></tr></table></td></tr></table></body></html>`;
  return { subject, text: textLines.join("\n"), html, locale: resolvedLocale, direction };
}

export function assertTemplateCoverage() {
  for (const locale of SUPPORTED_EMAIL_LOCALES) {
    for (const templateId of TEMPLATE_IDS) if (!subjectMaps[locale]?.[templateId]) throw new Error(`EMAIL_TRANSLATION_MISSING:${locale}:${templateId}`);
  }
  return true;
}

