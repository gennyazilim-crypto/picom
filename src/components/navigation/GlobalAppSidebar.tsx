import type { MouseEvent } from "react";
import type { Member } from "../../types/community";
import type { GlobalNavigationAvailability, GlobalNavigationBadgeState, GlobalNavigationKey } from "../../types/globalNavigation";
import { primaryGlobalNavigationItems, utilityGlobalNavigationItems } from "../../services/navigation/globalNavigationRegistry";
import { AppIcon } from "../AppIcon";
import { MemberAvatar } from "../MemberAvatar";
import { GlobalNavItem } from "./GlobalNavItem";
import "./globalNavigation.css";

type GlobalAppSidebarProps = Readonly<{
  activeRoute: GlobalNavigationKey | null;
  badges: GlobalNavigationBadgeState;
  availability: GlobalNavigationAvailability;
  currentUser: Member;
  compact?: boolean;
  onNavigate: (route: GlobalNavigationKey) => void;
  onOpenSettings: () => void;
  onOpenHelpSupport: () => void;
  onOpenProfile: () => void;
  onOpenUserMenu: (event: MouseEvent<HTMLButtonElement>) => void;
}>;

export function GlobalAppSidebar({ activeRoute, badges, availability, currentUser, compact = false, onNavigate, onOpenSettings, onOpenHelpSupport, onOpenProfile, onOpenUserMenu }: GlobalAppSidebarProps) {
  return (
    <aside className={`global-app-sidebar${compact ? " is-compact" : ""}`} aria-label="Picom global navigation">
      <button type="button" className="global-sidebar-brand" aria-label="Open Feed" onClick={() => onNavigate("feed")}>
        <span aria-hidden="true">P</span><strong>Picom</strong>
      </button>

      <nav className="global-sidebar-primary" aria-label="Main navigation">
        {primaryGlobalNavigationItems.map((item) => {
          const disabled = item.status(availability) === "unavailable";
          return <GlobalNavItem key={item.key} item={item} active={activeRoute === item.key} compact={compact} disabled={disabled} badge={item.badgeSelector(badges)} onClick={() => onNavigate(item.key as GlobalNavigationKey)} />;
        })}
      </nav>

      <div className="global-sidebar-bottom">
        <nav className="global-sidebar-utilities" aria-label="Application utilities">
          {utilityGlobalNavigationItems.map((item) => <GlobalNavItem key={item.key} item={item} active={false} compact={compact} disabled={false} badge={null} onClick={item.key === "settings" ? onOpenSettings : onOpenHelpSupport} />)}
        </nav>

        <footer className="global-user-card">
          <button type="button" className="global-user-card__identity" aria-label={`Open profile for ${currentUser.displayName}`} onClick={onOpenProfile}>
            <span className="global-user-card__avatar"><MemberAvatar member={currentUser} size={36} /><i className={`global-presence-dot is-${currentUser.status}`} aria-hidden="true" /></span>
            <span className="global-user-card__copy"><strong>{currentUser.displayName}</strong><small>{currentUser.statusText || currentUser.status}</small></span>
          </button>
          <button type="button" className="global-user-card__more" aria-label="Open user menu" onClick={onOpenUserMenu}><AppIcon name="more" size="sm" /></button>
        </footer>
      </div>
    </aside>
  );
}
