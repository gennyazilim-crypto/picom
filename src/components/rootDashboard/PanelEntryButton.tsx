import { AppIcon } from "../AppIcon";
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
  if (accessStatus === "denied") return null;

  if (accessStatus === "loading") {
    return (
      <button
        type="button"
        className="global-nav-item rd-panel-entry is-skeleton"
        data-global-navigation-button="true"
        aria-busy="true"
        aria-label="Checking Panel access"
        disabled
        title="Checking Panel access"
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
      aria-label="Open Panel"
      aria-current={active ? "page" : undefined}
      title="Open root operations Panel"
      onClick={onOpen}
    >
      <span className="global-nav-item__icon" aria-hidden="true">
        <AppIcon name="home" size="lg" />
      </span>
      {compact ? null : <span className="global-nav-item__label">Panel</span>}
    </button>
  );
}
