import { ACCOUNT_SUPPORT_EMAIL, SUPPORT_HOME_URL } from "../config";
import { t } from "../i18n/messages";

/** Lightweight pointer from Account Center → Support Center host. */
export function SupportPage() {
  return (
    <section className="ac-card ac-stack">
      <h1>{t("support.title")}</h1>
      <p className="ac-muted">{t("support.body")}</p>
      <p className="ac-muted">{t("support.security")}</p>
      <div className="ac-actions">
        <a className="ac-btn ac-btn--primary" href={SUPPORT_HOME_URL}>
          {t("nav.support")}
        </a>
        <a className="ac-btn" href={`mailto:${ACCOUNT_SUPPORT_EMAIL}`}>{ACCOUNT_SUPPORT_EMAIL}</a>
      </div>
    </section>
  );
}
