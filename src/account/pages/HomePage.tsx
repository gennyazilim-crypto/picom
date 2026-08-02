import { Link } from "react-router-dom";
import { PublicLayout } from "../components/PublicLayout";
import { SUPPORT_HOME_URL } from "../config";
import { t } from "../i18n/messages";
import { useAuth } from "../lib/session";
import { ROUTES } from "../routes";

export function HomePage() {
  const { session } = useAuth();

  return (
    <PublicLayout>
      <section className="ac-public-hero">
        <p className="ac-public-hero__eyebrow">{t("brand.account")}</p>
        <h1>{t("home.title")}</h1>
        <p className="ac-muted">{t("home.subtitle")}</p>
        <div className="ac-public-hero__actions">
          {session ? (
            <Link className="ac-btn ac-btn--primary ac-btn--auth" to={ROUTES.accountOverview}>
              {t("home.account")}
            </Link>
          ) : (
            <>
              <Link className="ac-btn ac-btn--primary ac-btn--auth" to={ROUTES.login}>
                {t("home.login")}
              </Link>
              <Link className="ac-btn ac-btn--secondary" to={ROUTES.register}>
                {t("home.register")}
              </Link>
            </>
          )}
          <a className="ac-btn ac-btn--ghost" href={SUPPORT_HOME_URL}>
            {t("home.support")}
          </a>
        </div>
      </section>
    </PublicLayout>
  );
}
