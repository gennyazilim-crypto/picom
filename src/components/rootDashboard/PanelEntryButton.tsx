import { AppIcon } from "../AppIcon";
import { useTranslation } from "../../i18n";
import type { RootDashboardAccessStatus } from "../../services/rootDashboard/rootDashboardAccessService";

type PanelEntryButtonProps = Readonly<{
  compact?: boolean;
  active?: boolean;
  accessStatus: RootDashboardAccessStatus;
  onOpen: () => void;
}>;

/**
 * Global-sidebar Panel entry. Denied → null (no flash). Loading → non-claiming skeleton.
 * Home mark matches the Picom mockup CTA (distinct from Settings gear).
 */
export function PanelEntryButton({ compact = false, active = false, accessStatus, onOpen }: PanelEntryButtonProps) {
  const { t } = useTranslation("admin");
  if (accessStatus === "denied") return null;

  if (accessStatus === "loading") {
    return (
      <button
        type="button"
        className="global-nav-item rd-panel-entry is-skeleton"
        data-global-navigation-button="true"
        aria-busy="true"
        aria-label={t("panel.checkingAccess")}
        disabled
        title={t("panel.checkingAccess")}
      >
        <span className="global-nav-item__icon" aria-hidden="true">
          <AppIcon name="home" size="lg" />
        </span>
        {compact ? null : <span className="global-nav-item__label">…</span>}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`global-nav-item rd-panel-entry${active ? " is-active" : ""}`}
      data-global-navigation-button="true"
      aria-label={t("panel.open")}
      aria-current={active ? "page" : undefined}
      title={t("panel.openTitle")}
      onClick={onOpen}
    >
      <span className="global-nav-item__icon" aria-hidden="true">
        <AppIcon name="home" size="lg" />
      </span>
      {compact ? null : <span className="global-nav-item__label">{t("panel.name")}</span>}
    </button>
  );
}
