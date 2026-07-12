import type { MouseEventHandler } from "react";
import type { GlobalNavigationRegistryItem } from "../../types/globalNavigation";
import { AppIcon } from "../AppIcon";
import { GlobalNavBadge } from "./GlobalNavBadge";

type GlobalNavItemProps = Readonly<{
  item: GlobalNavigationRegistryItem;
  active: boolean;
  compact: boolean;
  disabled: boolean;
  badge: number | string | null;
  onClick: MouseEventHandler<HTMLButtonElement>;
}>;

export function GlobalNavItem({ item, active, compact, disabled, badge, onClick }: GlobalNavItemProps) {
  const title = disabled ? item.unavailableReason ?? `${item.label} is unavailable.` : compact ? item.label : undefined;
  return (
    <button
      type="button"
      className={`global-nav-item${active ? " is-active" : ""}`}
      data-global-navigation-button="true"
      aria-label={item.ariaLabel}
      aria-current={active ? "page" : undefined}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      title={title}
      onClick={onClick}
    >
      <span className="global-nav-item__icon" aria-hidden="true"><AppIcon name={item.icon} size="lg" /></span>
      <span className="global-nav-item__label" title={!compact ? item.label : undefined}>{item.label}</span>
      <GlobalNavBadge value={badge} />
    </button>
  );
}
