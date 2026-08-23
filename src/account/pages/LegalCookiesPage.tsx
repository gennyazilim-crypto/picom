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
      <h2>2. Optional advertising measurement</h2>
      <p>
        If Google Ads is configured for this Account Center build, its tag loads only after you choose to allow optional measurement.
        Choosing necessary-only keeps Google Ads measurement off. Your choice controls ad storage, analytics storage, ad user data,
        and ad personalization together and can be changed through Cookie settings.
      </p>
      <h2>3. Managing storage</h2>
      <p>
        Clearing site data in your browser signs you out. Signing out from Account Center removes the local auth session for this origin.
        Blocking all storage may prevent authentication.
      </p>
      <p>
        This technical description is not a legal determination of the applicable lawful basis, retention, international transfer,
        or regional consent requirements. LEGAL_REVIEW_REQUIRED before enabling Google Ads in production.
      </p>
    </article>
  );
}
