import { LEGAL_POLICY_VERSION } from "../config";
import { t } from "../i18n/messages";

export function LegalTermsPage() {
  return (
    <article className="ac-card ac-prose">
      <h1>{t("legal.terms.title")}</h1>
      <p className="ac-muted">{t("legal.draftNotice")} Version {LEGAL_POLICY_VERSION.terms}.</p>
      <h2>1. Service</h2>
      <p>
        Picom provides community chat features including accounts, profiles, communities, channels, messaging,
        and Account Center controls. Availability may vary by region and release channel.
      </p>
      <h2>2. Accounts</h2>
      <p>
        You must meet the minimum age for your region, provide accurate registration information, protect credentials,
        and report suspected compromise. Critical account operations are performed through account.picom.gg.
      </p>
      <h2>3. Acceptable use</h2>
      <p>
        Illegal activity, harassment, exploitation, impersonation, malware, spam, and attempts to bypass security controls are prohibited.
        Community owners and moderators must use permissions proportionately.
      </p>
      <h2>4. Termination</h2>
      <p>
        Picom may suspend access to prevent harm or comply with law. You may request account deletion after transferring owned communities.
        Misuse may result in restriction or removal.
      </p>
    </article>
  );
}
