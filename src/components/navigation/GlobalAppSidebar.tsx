import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import type { Member } from "../../types/community";
import type { GlobalNavigationAvailability, GlobalNavigationBadgeState, GlobalNavigationKey, GlobalUtilityKey } from "../../types/globalNavigation";
import { primaryGlobalNavigationItems, utilityGlobalNavigationItems } from "../../services/navigation/globalNavigationRegistry";
import { GlobalNavItem } from "./GlobalNavItem";
import { GlobalUserCard } from "./GlobalUserCard";
import "./globalNavigation.css";

type GlobalAppSidebarProps = Readonly<{
  activeRoute: GlobalNavigationKey | null;
  activeUtility?: GlobalUtilityKey | null;
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

const compactSidebarQuery = "(max-width: 1320px)";

function useResponsiveCompactMode(): boolean {
  const [matches, setMatches] = useState(() => typeof window !== "undefined" && window.matchMedia(compactSidebarQuery).matches);

  useEffect(() => {
    const media = window.matchMedia(compactSidebarQuery);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return matches;
}

export function GlobalAppSidebar({ activeRoute, activeUtility = null, badges, availability, currentUser, compact = false, onNavigate, onOpenSettings, onOpenHelpSupport, onOpenProfile, onOpenUserMenu }: GlobalAppSidebarProps) {
  const rootRef = useRef<HTMLElement>(null);
  const responsiveCompact = useResponsiveCompactMode();
  const isCompact = compact || responsiveCompact;

  const moveNavigationFocus = (event: KeyboardEvent<HTMLElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    if (!(event.target instanceof HTMLElement) || !event.target.closest("[data-global-navigation-button='true']")) return;
    const buttons = Array.from(rootRef.current?.querySelectorAll<HTMLButtonElement>("[data-global-navigation-button='true']:not(:disabled)") ?? []);
    const currentButton = event.target.closest<HTMLButtonElement>("button");
    const currentIndex = currentButton ? buttons.indexOf(currentButton) : -1;
    if (currentIndex < 0 || buttons.length === 0) return;
    event.preventDefault();
    const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : event.key === "ArrowDown" ? (currentIndex + 1) % buttons.length : (currentIndex - 1 + buttons.length) % buttons.length;
    buttons[nextIndex]?.focus();
  };

  return (
    <aside ref={rootRef} className={`global-app-sidebar${isCompact ? " is-compact" : ""}`} data-navigation-mode={isCompact ? "compact" : "wide"} aria-label="Picom global navigation" onKeyDown={moveNavigationFocus}>
      <button type="button" className="global-sidebar-brand" data-global-navigation-button="true" aria-label="Open Feed" title={isCompact ? "Feed" : undefined} onClick={() => onNavigate("feed")}>
        <span aria-hidden="true">P</span><strong>Picom</strong>
      </button>

      <nav className="global-sidebar-primary" aria-label="Main navigation">
        {primaryGlobalNavigationItems.map((item) => {
          const disabled = item.status(availability) === "unavailable";
          return <GlobalNavItem key={item.key} item={item} active={activeRoute === item.key} compact={isCompact} disabled={disabled} badge={item.badgeSelector(badges)} onClick={() => onNavigate(item.key as GlobalNavigationKey)} />;
        })}
      </nav>

      <div className="global-sidebar-bottom">
        <nav className="global-sidebar-utilities" aria-label="Application utilities">
          {utilityGlobalNavigationItems.map((item) => <GlobalNavItem key={item.key} item={item} active={activeUtility === item.key} compact={isCompact} disabled={false} badge={null} onClick={item.key === "settings" ? onOpenSettings : onOpenHelpSupport} />)}
        </nav>

        <GlobalUserCard currentUser={currentUser} compact={isCompact} onOpenProfile={onOpenProfile} onOpenUserMenu={onOpenUserMenu} />
      </div>
    </aside>
  );
}
