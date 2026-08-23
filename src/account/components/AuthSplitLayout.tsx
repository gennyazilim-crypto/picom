import { Link } from "react-router-dom";
import { brandLogoUrl } from "../../config/brandAssets";
import { SUPPORT_HOME_URL } from "../config";
import { t } from "../i18n/messages";
import { ROUTES } from "../routes";

function BrandMark() {
  return (
    <span className="ac-brand-lockup">
      <img className="ac-brand-lockup__logo" src={brandLogoUrl} alt="" width={44} height={44} decoding="async" />
      <span className="ac-brand-lockup__word">{t("brand.name")}</span>
    </span>
  );
}

function PointIcon({ kind }: { kind: "shield" | "mail" | "support" }) {
  if (kind === "shield") {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
        <path d="M12 3.5 5 6.5v5.2c0 4.3 2.8 7.8 7 9.3 4.2-1.5 7-5 7-9.3V6.5L12 3.5Z" stroke="currentColor" strokeWidth="1.6" />
        <path d="m9.2 12.1 1.9 1.9 3.7-3.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === "mail") {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
        <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="m4.5 7.5 7.5 5.5 7.5-5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 8.2v4.3M12 15.8h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Split auth shell: left brand panel + right form card.
 * Used for login/register/forgot/reset public flows.
 */
export function AuthSplitLayout({
  children,
  eyebrow,
  title,
  subtitle,
  wide = false,
}: {
  children: React.ReactNode;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  wide?: boolean;
}) {
  const points = [
    { kind: "shield" as const, text: t("login.hero.point1") },
    { kind: "mail" as const, text: t("login.hero.point2") },
    { kind: "support" as const, text: t("login.hero.point3") },
  ];

  return (
    <div className={`ac-auth-split${wide ? " ac-auth-split--wide" : ""}`}>
      <aside className="ac-auth-split__brand" aria-hidden="false">
        <div className="ac-auth-split__atmosphere" aria-hidden="true">
          <div className="ac-auth-split__mesh" />
          <div className="ac-auth-split__orb ac-auth-split__orb--a" />
          <div className="ac-auth-split__orb ac-auth-split__orb--b" />
          <div className="ac-auth-split__orb ac-auth-split__orb--c" />
          <div className="ac-auth-split__ring" />
        </div>

        <div className="ac-auth-split__brand-inner">
          <Link className="ac-brand ac-brand--hero" to={ROUTES.home}>
            <BrandMark />
          </Link>
          <p className="ac-auth-split__product">{t("brand.account")}</p>

          <div className="ac-auth-split__copy">
            <p className="ac-auth-split__eyebrow">{eyebrow ?? t("login.hero.eyebrow")}</p>
            <h1 className="ac-auth-split__headline">{title ?? t("login.hero.title")}</h1>
            <p className="ac-auth-split__lede">{subtitle ?? t("login.hero.subtitle")}</p>
          </div>

          <ul className="ac-auth-split__points">
            {points.map((point) => (
              <li key={point.kind}>
                <span className="ac-auth-split__point-icon">
                  <PointIcon kind={point.kind} />
                </span>
                <span>{point.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <section className="ac-auth-split__panel">
        <div className={`ac-auth-split__card${wide ? " ac-auth-split__card--wide" : ""}`}>{children}</div>
        <footer className="ac-auth-split__footer">
          <Link to={ROUTES.legalPrivacy}>{t("legal.privacy.title")}</Link>
          <Link to={ROUTES.legalTerms}>{t("legal.terms.title")}</Link>
          <a href={SUPPORT_HOME_URL}>{t("nav.support")}</a>
        </footer>
      </section>
    </div>
  );
}
