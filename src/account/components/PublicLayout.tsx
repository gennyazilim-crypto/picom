import { Link, NavLink } from "react-router-dom";
import { brandLogoUrl } from "../../config/brandAssets";
import { SUPPORT_HOME_URL } from "../config";
import { t } from "../i18n/messages";
import { ROUTES } from "../routes";

function BrandLockup() {
  return (
    <span className="ac-brand-lockup ac-brand-lockup--compact">
      <img className="ac-brand-lockup__logo" src={brandLogoUrl} alt="" width={28} height={28} decoding="async" />
      <span className="ac-brand-lockup__text">
        <span className="ac-brand-lockup__word">{t("brand.name")}</span>
        <span className="ac-brand-lockup__sub">{t("brand.account")}</span>
      </span>
    </span>
  );
}

export function PublicLayout({
  children,
  wide = false,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="ac-public">
      <div className="ac-public__atmosphere" aria-hidden="true">
        <div className="ac-public__mesh" />
        <div className="ac-public__glow ac-public__glow--a" />
        <div className="ac-public__glow ac-public__glow--b" />
        <div className="ac-public__glow ac-public__glow--c" />
        <div className="ac-public__vignette" />
      </div>

      <header className="ac-public__header">
        <Link className="ac-brand ac-brand--public" to={ROUTES.home}>
          <BrandLockup />
        </Link>
        <nav className="ac-public__nav" aria-label="Primary">
          <div className="ac-public__nav-group">
            <NavLink to={ROUTES.login}>{t("home.login")}</NavLink>
            <NavLink to={ROUTES.register} className={({ isActive }) => (isActive ? "active" : undefined)}>
              {t("home.register")}
            </NavLink>
            <a className="ac-public__nav-support" href={SUPPORT_HOME_URL}>{t("nav.support")}</a>
          </div>
        </nav>
      </header>

      <main className={`ac-public__main${wide ? " ac-public__main--wide" : ""}`}>
        <div className="ac-public__stage">{children}</div>
      </main>

      <footer className="ac-public__footer">
        <div className="ac-public__footer-links">
          <Link to={ROUTES.legalPrivacy}>{t("legal.privacy.title")}</Link>
          <Link to={ROUTES.legalTerms}>{t("legal.terms.title")}</Link>
          <Link to={ROUTES.legalCookies}>{t("legal.cookies.title")}</Link>
          <a href={SUPPORT_HOME_URL}>{t("nav.support")}</a>
        </div>
      </footer>
    </div>
  );
}
