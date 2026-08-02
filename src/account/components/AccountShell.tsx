import { useEffect, useMemo, useState, type ComponentType, type SVGProps } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { UserAvatar } from "../../components/UserAvatar";
import { APP_HOME_URL, SUPPORT_HOME_URL } from "../config";
import { brandLogoUrl } from "../../config/brandAssets";
import { t } from "../i18n/messages";
import { useAuth } from "../lib/session";
import { fetchSoftEmailVerificationStatus } from "../lib/softEmailVerification";
import { useAccountTheme } from "../lib/theme";
import { ROUTES } from "../routes";
import {
  IconAlert,
  IconBadge,
  IconBell,
  IconChevronLeft,
  IconChevronRight,
  IconDatabase,
  IconDevices,
  IconHome,
  IconKey,
  IconLock,
  IconMail,
  IconMenu,
  IconMonitor,
  IconMoon,
  IconOverview,
  IconProfile,
  IconShield,
  IconSignOut,
  IconSliders,
  IconSun,
  IconSupport,
} from "./AccountIcons";
import { ThemeSelector } from "./ThemeSelector";

type IconComp = ComponentType<SVGProps<SVGSVGElement>>;

type NavItem = {
  to: string;
  labelKey: string;
  Icon: IconComp;
  end?: boolean;
  badge?: "email";
};

type NavSection = {
  labelKey: string;
  items: NavItem[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    labelKey: "nav.section.account",
    items: [
      { to: ROUTES.accountOverview, labelKey: "nav.overview", Icon: IconOverview, end: true },
      { to: ROUTES.profile, labelKey: "nav.profile", Icon: IconProfile },
      { to: ROUTES.emailVerification, labelKey: "nav.emailVerification", Icon: IconMail, badge: "email" },
      { to: ROUTES.profileVerification, labelKey: "nav.profileVerification", Icon: IconBadge },
    ],
  },
  {
    labelKey: "nav.section.security",
    items: [
      { to: ROUTES.security, labelKey: "nav.security", Icon: IconShield, end: true },
      { to: ROUTES.connections, labelKey: "nav.connections", Icon: IconDevices },
      { to: ROUTES.passwordChange, labelKey: "nav.password", Icon: IconKey },
      { to: ROUTES.emailChange, labelKey: "nav.emailAddress", Icon: IconMail },
      { to: ROUTES.mfa, labelKey: "nav.mfa", Icon: IconLock },
      { to: ROUTES.sessions, labelKey: "nav.sessions", Icon: IconDevices },
    ],
  },
  {
    labelKey: "nav.section.preferences",
    items: [
      { to: ROUTES.preferences, labelKey: "nav.preferences", Icon: IconSliders },
      { to: ROUTES.notifications, labelKey: "nav.notifications", Icon: IconBell },
    ],
  },
  {
    labelKey: "nav.section.privacy",
    items: [
      { to: ROUTES.privacy, labelKey: "nav.privacy", Icon: IconLock },
      { to: ROUTES.dataExport, labelKey: "nav.dataExport", Icon: IconDatabase },
    ],
  },
  {
    labelKey: "nav.section.actions",
    items: [
      { to: ROUTES.deactivate, labelKey: "nav.deactivate", Icon: IconAlert },
      { to: ROUTES.deleteAccount, labelKey: "nav.delete", Icon: IconAlert },
    ],
  },
];

const PAGE_TITLES: Record<string, string> = {
  [ROUTES.accountOverview]: "nav.overview",
  [ROUTES.profile]: "nav.profile",
  [ROUTES.profileSetup]: "nav.profile",
  [ROUTES.profileVerification]: "nav.profileVerification",
  [ROUTES.emailVerification]: "nav.emailVerification",
  [ROUTES.emailVerificationPending]: "nav.emailVerification",
  [ROUTES.security]: "nav.security",
  [ROUTES.passwordChange]: "nav.password",
  [ROUTES.emailChange]: "nav.emailAddress",
  [ROUTES.mfa]: "nav.mfa",
  [ROUTES.sessions]: "nav.sessions",
  [ROUTES.preferences]: "nav.preferences",
  [ROUTES.notifications]: "nav.notifications",
  [ROUTES.privacy]: "nav.privacy",
  [ROUTES.dataExport]: "nav.dataExport",
  [ROUTES.data]: "nav.dataExport",
  [ROUTES.deactivate]: "nav.deactivate",
  [ROUTES.deleteAccount]: "nav.delete",
};

const COLLAPSE_KEY = "picom.account.nav_collapsed";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

export function AccountShell() {
  const { signOut, user } = useAuth();
  const { mode, resolved } = useAccountTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [emailPending, setEmailPending] = useState(false);

  useEffect(() => {
    void fetchSoftEmailVerificationStatus().then((status) => {
      setEmailPending(!status.isEmailVerified && !status.offline);
    });
  }, [location.pathname]);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      // ignore
    }
  }, [collapsed]);

  useEffect(() => {
    setNavOpen(false);
    setThemeMenuOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  const titleKey = PAGE_TITLES[location.pathname] ?? "brand.account";
  const emailLabel = user?.email ?? "";
  const displayName = (user?.user_metadata?.display_name as string | undefined) || emailLabel.split("@")[0] || "PICOM";
  const username = (user?.user_metadata?.username as string | undefined) || "";

  const ThemeIcon = useMemo(() => {
    if (mode === "light") return IconSun;
    if (mode === "dark") return IconMoon;
    return IconMonitor;
  }, [mode]);

  const onSignOut = async () => {
    await signOut();
    navigate(ROUTES.login);
  };

  const closeNav = () => setNavOpen(false);

  return (
    <div
      className={`ac-shell${navOpen ? " ac-shell--nav-open" : ""}${collapsed ? " ac-shell--collapsed" : ""}`}
    >
      <button type="button" className="ac-shell__backdrop" aria-label={t("nav.closeMenu")} onClick={closeNav} />

      <aside className="ac-shell__nav" aria-label={t("nav.menu")}>
        <div className="ac-shell__brand-row">
          <NavLink className="ac-shell__brand" to={ROUTES.accountOverview} onClick={closeNav}>
            <img className="ac-shell__logo" src={brandLogoUrl} alt="" width={28} height={28} />
            <span className="ac-shell__brand-text">
              <span className="ac-shell__brand-name">{t("brand.name")}</span>
              <span className="ac-shell__brand-badge">{t("brand.account")}</span>
            </span>
          </NavLink>
          <button
            type="button"
            className="ac-icon-btn ac-shell__collapse"
            aria-label={collapsed ? t("nav.expandSidebar") : t("nav.collapseSidebar")}
            title={collapsed ? t("nav.expandSidebar") : t("nav.collapseSidebar")}
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
          </button>
        </div>

        <nav className="ac-shell__nav-scroll">
          {NAV_SECTIONS.map((section) => (
            <div key={section.labelKey} className="ac-shell__section-block">
              <div className="ac-shell__section">{t(section.labelKey)}</div>
              <ul className="ac-shell__nav-list">
                {section.items.map((item) => {
                  const showBadge = item.badge === "email" && emailPending;
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.end}
                        title={t(item.labelKey)}
                        className={({ isActive }) =>
                          `ac-shell__link${isActive ? " ac-shell__link--active" : ""}${
                            section.labelKey === "nav.section.actions" ? " ac-shell__link--danger" : ""
                          }`
                        }
                        onClick={closeNav}
                      >
                        <item.Icon className="ac-shell__link-icon" />
                        <span className="ac-shell__link-label">{t(item.labelKey)}</span>
                        {showBadge ? (
                          <span className="ac-shell__link-badge" aria-label={t("softVerify.unverified")}>
                            !
                          </span>
                        ) : null}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="ac-shell__footer">
          <a className="ac-shell__link" href={SUPPORT_HOME_URL} title={t("nav.support")}>
            <IconSupport className="ac-shell__link-icon" />
            <span className="ac-shell__link-label">{t("nav.support")}</span>
          </a>
          <a className="ac-shell__link" href={APP_HOME_URL} title={t("nav.returnToPicom")}>
            <IconHome className="ac-shell__link-icon" />
            <span className="ac-shell__link-label">{t("nav.returnToPicom")}</span>
          </a>
          <button type="button" className="ac-shell__link ac-shell__link--signout" onClick={() => void onSignOut()}>
            <IconSignOut className="ac-shell__link-icon" />
            <span className="ac-shell__link-label">{t("nav.signOut")}</span>
          </button>
        </div>
      </aside>

      <div className="ac-shell__main">
        <header className="ac-shell__header">
          <div className="ac-shell__header-left">
            <button
              type="button"
              className="ac-icon-btn ac-shell__menu-btn"
              aria-label={t("nav.openMenu")}
              onClick={() => setNavOpen(true)}
            >
              <IconMenu />
            </button>
            <div className="ac-shell__header-titles">
              <p className="ac-shell__breadcrumb">
                <Link to={ROUTES.accountOverview}>{t("brand.account")}</Link>
                <span aria-hidden="true"> / </span>
                <span>{t(titleKey)}</span>
              </p>
              <h1 className="ac-shell__page-title">{t(titleKey)}</h1>
            </div>
          </div>

          <div className="ac-shell__header-right">
            <a
              className="ac-icon-btn"
              href={SUPPORT_HOME_URL}
              aria-label={t("nav.support")}
              title={t("nav.support")}
            >
              <IconSupport />
            </a>

            <div className="ac-shell__menu-wrap">
              <button
                type="button"
                className="ac-icon-btn"
                aria-label={t("preferences.theme")}
                aria-expanded={themeMenuOpen}
                aria-haspopup="true"
                title={t("preferences.theme")}
                onClick={() => {
                  setThemeMenuOpen((open) => !open);
                  setUserMenuOpen(false);
                }}
              >
                <ThemeIcon />
              </button>
              {themeMenuOpen ? (
                <div className="ac-popover" role="dialog" aria-label={t("preferences.theme")}>
                  <ThemeSelector
                    variant="menu"
                    onSelect={() => setThemeMenuOpen(false)}
                  />
                  <p className="ac-popover__hint">
                    {t("preferences.theme.current")}: {resolved === "light" ? t("preferences.theme.light") : t("preferences.theme.dark")}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="ac-shell__menu-wrap">
              <button
                type="button"
                className="ac-shell__user-chip"
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
                onClick={() => {
                  setUserMenuOpen((open) => !open);
                  setThemeMenuOpen(false);
                }}
              >
                <span className="ac-shell__avatar" aria-hidden="true">
                  <UserAvatar userId={user?.id} displayName={displayName} size={30} priority="eager" />
                </span>
                <span className="ac-shell__user-meta">
                  <strong>{displayName}</strong>
                  {username ? <span>@{username}</span> : emailLabel ? <span>{emailLabel}</span> : null}
                </span>
              </button>
              {userMenuOpen ? (
                <div className="ac-popover ac-popover--user" role="menu">
                  <Link role="menuitem" to={ROUTES.profile} onClick={() => setUserMenuOpen(false)}>
                    {t("nav.profile")}
                  </Link>
                  <Link role="menuitem" to={ROUTES.preferences} onClick={() => setUserMenuOpen(false)}>
                    {t("nav.preferences")}
                  </Link>
                  <button role="menuitem" type="button" onClick={() => void onSignOut()}>
                    {t("nav.signOut")}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className="ac-shell__content">
          <div className="ac-shell__content-inner">
            <Outlet />
          </div>
        </main>
      </div>

      {(themeMenuOpen || userMenuOpen) && (
        <button
          type="button"
          className="ac-shell__dismiss"
          aria-label={t("nav.closeMenu")}
          onClick={() => {
            setThemeMenuOpen(false);
            setUserMenuOpen(false);
          }}
        />
      )}
    </div>
  );
}
