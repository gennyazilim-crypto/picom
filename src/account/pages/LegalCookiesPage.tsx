import { LEGAL_POLICY_VERSION } from "../config";
import { t } from "../i18n/messages";

export function LegalCookiesPage() {
  return (
    <article className="ac-card ac-prose">
      <h1>{t("legal.cookies.title")}</h1>
      <p className="ac-muted">{t("legal.draftNotice")} Version {LEGAL_POLICY_VERSION.cookies}.</p>
      <h2>1. Essential storage</h2>
      <p>
        Account Center uses essential cookies and local storage for authentication session persistence (Supabase Auth PKCE),
        locale preference, and device session registration. These are required for sign-in to work.
      </p>
      <h2>2. No advertising cookies</h2>
      <p>
        This Account Center build does not load third-party advertising cookies. Optional product emails are controlled by your
        marketing preference in Notifications, not by advertising cookies on this domain.
      </p>
      <h2>3. Managing storage</h2>
      <p>
        Clearing site data in your browser signs you out. Signing out from Account Center removes the local auth session for this origin.
        Blocking all storage may prevent authentication.
      </p>
    </article>
  );
}
