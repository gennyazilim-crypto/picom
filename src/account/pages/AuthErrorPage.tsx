import { Link } from "react-router-dom";
import { SUPPORT_HOME_URL } from "../config";
import { t } from "../i18n/messages";
import { ROUTES } from "../routes";

export function AuthErrorPage() {
  return (
    <section className="ac-card">
      <h1>{t("authError.title")}</h1>
      <p className="ac-muted">{t("authError.body")}</p>
      <p>
        <Link to={ROUTES.login}>{t("login.title")}</Link>
        {" · "}
        <a href={SUPPORT_HOME_URL}>{t("nav.support")}</a>
      </p>
    </section>
  );
}
