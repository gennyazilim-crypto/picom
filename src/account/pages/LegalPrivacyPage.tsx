import { LEGAL_POLICY_VERSION } from "../config";
import { ACCOUNT_PRIVACY_EMAIL } from "../config";
import { t } from "../i18n/messages";

export function LegalPrivacyPage() {
  return (
    <article className="ac-card ac-prose">
      <h1>{t("legal.privacy.title")}</h1>
      <p className="ac-muted">{t("legal.draftNotice")} Version {LEGAL_POLICY_VERSION.privacy}.</p>
      <h2>1. Scope</h2>
      <p>
        This notice describes how Picom processes personal data for Account Center and related community chat services.
        Privacy questions: {ACCOUNT_PRIVACY_EMAIL}.
      </p>
      <h2>2. Data categories</h2>
      <p>
        Account identifiers (user ID, email, username), profile content you provide, session and security events,
        community and messaging content you create, and support communications. Passwords are handled by the authentication provider
        and are not written to application logs.
      </p>
      <h2>3. Purposes</h2>
      <p>
        We process data to authenticate users, provide account features, secure the service, prevent abuse, meet legal obligations,
        and respond to support. Optional product emails require marketing opt-in and can be withdrawn in Notifications.
      </p>
      <h2>3a. Optional advertising measurement</h2>
      <p>
        If enabled by Picom, Google Ads conversion measurement is optional and loads only after a visitor allows optional measurement.
        The implementation does not send account email, username, password, message content, IP address, or raw Picom user ID as a
        conversion event payload. LEGAL_REVIEW_REQUIRED for the final provider notice, lawful basis, retention, transfer, and regional scope.
      </p>
      <h2>4. Retention and deletion</h2>
      <p>
        Data export and account deletion are available in Account Center. Deletion starts a 14-day review period, revokes sessions,
        and proceeds to controlled anonymization after ownership-transfer requirements are met.
      </p>
      <h2>5. Your choices</h2>
      <p>
        Update profile and privacy settings, manage notifications, export a bounded JSON copy of your data, deactivate, or request deletion.
        Regional rights may include access, correction, deletion, restriction, and objection.
      </p>
    </article>
  );
}
