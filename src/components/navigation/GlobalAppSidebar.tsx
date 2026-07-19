import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import type { Community, Member } from "../../types/community";
import type { GlobalNavigationAvailability, GlobalNavigationBadgeState, GlobalNavigationKey, GlobalUtilityKey } from "../../types/globalNavigation";
import { primaryGlobalNavigationItems, utilityGlobalNavigationItems } from "../../services/navigation/globalNavigationRegistry";
import type { UserSettingsSection } from "../../services/navigation/settingsNavigationPolicyService";
import { brandLogoUrl } from "../../config/brandAssets";
import { brandConfig } from "../../config/brandConfig";
import { AppIcon } from "../AppIcon";
import { GlobalCommunitiesNav } from "./GlobalCommunitiesNav";
import { GlobalNavItem } from "./GlobalNavItem";
import { GlobalSettingsNav } from "./GlobalSettingsNav";
import { GlobalUserCard } from "./GlobalUserCard";
import { PanelEntryButton } from "../rootDashboard/PanelEntryButton";
import type { RootDashboardAccessStatus } from "../../services/rootDashboard/rootDashboardAccessService";
import "./globalNavigation.css";

type GlobalAppSidebarProps = Readonly<{
  activeRoute: GlobalNavigationKey | null;
  activeUtility?: GlobalUtilityKey | null;
  badges: GlobalNavigationBadgeState;
  availability: GlobalNavigationAvailability;
  currentUser: Member;
  communities?: readonly Community[];
  activeCommunityId?: string | null;
  onSelectCommunity?: (communityId: string) => void;
  compact?: boolean;
  settingsOpen?: boolean;
  activeSettingsSection?: UserSettingsSection | null;
  onNavigate: (route: GlobalNavigationKey) => void;
  onOpenSettings: (section?: UserSettingsSection) => void;
  onOpenHelpSupport: () => void;
  onOpenProfile: () => void;
  onOpenUserMenu: (event: MouseEvent<HTMLButtonElement>) => void;
  panelAccessStatus?: RootDashboardAccessStatus;
  onOpenPanel?: () => void;
  isPanelActive?: boolean;
}>;

const compactSidebarQuery = "(max-width: 1320px)";
const sidebarCollapsedStorageKey = "picom.global-sidebar.collapsed";
const sidebarForceWideStorageKey = "picom.global-sidebar.force-wide";

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

function readStorageFlag(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeStorageFlag(key: string, value: boolean) {
  try {
    window.localStorage.setItem(key, value ? "1" : "0");
  } catch {
    /* Best effort only. */
  }
}

const workspaceRoutes = new Set<GlobalNavigationKey>(["feed", "dm", "communities"]);

export function GlobalAppSidebar({ activeRoute, activeUtility = null, badges, availability, currentUser, communities = [], activeCommunityId = null, onSelectCommunity, compact = false, settingsOpen = false, activeSettingsSection = null, onNavigate, onOpenSettings, onOpenHelpSupport, onOpenProfile, onOpenUserMenu, panelAccessStatus, onOpenPanel, isPanelActive = false }: GlobalAppSidebarProps) {
  const rootRef = useRef<HTMLElement>(null);
  const responsiveCompact = useResponsiveCompactMode();
  const [userCollapsed, setUserCollapsed] = useState(() => readStorageFlag(sidebarCollapsedStorageKey));
  const [forceWide, setForceWide] = useState(() => readStorageFlag(sidebarForceWideStorageKey));
  const isCompact = compact || (forceWide ? false : userCollapsed || responsiveCompact);
  const canToggle = !compact;

  const collapseForWorkspace = useCallback(() => {
    setForceWide(false);
    setUserCollapsed(true);
    writeStorageFlag(sidebarForceWideStorageKey, false);
    writeStorageFlag(sidebarCollapsedStorageKey, true);
  }, []);

  const toggleCollapsed = useCallback(() => {
    if (isCompact) {
      setForceWide(true);
      setUserCollapsed(false);
      writeStorageFlag(sidebarForceWideStorageKey, true);
      writeStorageFlag(sidebarCollapsedStorageKey, false);
      return;
    }
    setForceWide(false);
    setUserCollapsed(true);
    writeStorageFlag(sidebarForceWideStorageKey, false);
    writeStorageFlag(sidebarCollapsedStorageKey, true);
  }, [isCompact]);

  // Feed / DM / Communities need the main workspace width — auto-collapse the rail on entry.
  useEffect(() => {
    if (!activeRoute || !workspaceRoutes.has(activeRoute)) return;
    collapseForWorkspace();
  }, [activeRoute, collapseForWorkspace]);

  const handleNavigate = useCallback((route: GlobalNavigationKey) => {
    if (workspaceRoutes.has(route)) collapseForWorkspace();
    onNavigate(route);
  }, [collapseForWorkspace, onNavigate]);

  const handleSelectCommunity = useCallback((communityId: string) => {
    collapseForWorkspace();
    if (onSelectCommunity) onSelectCommunity(communityId);
    else onNavigate("communities");
  }, [collapseForWorkspace, onNavigate, onSelectCommunity]);

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
    <aside
      ref={rootRef}
      className={`global-app-sidebar${isCompact ? " is-compact" : ""}`}
      data-navigation-mode={isCompact ? "compact" : "wide"}
      aria-label="Picom global navigation"
      aria-expanded={!isCompact}
      onKeyDown={moveNavigationFocus}
    >
      <div className="global-sidebar-head">
        <button type="button" className="global-sidebar-brand" data-global-navigation-button="true" aria-label="Open Feed" title={isCompact ? "Feed" : undefined} onClick={() => handleNavigate("feed")}>
          <span className="global-sidebar-brand__mark" aria-hidden="true">
            <img className="picom-brand-logo" src={brandLogoUrl} alt="" width={34} height={34} decoding="async" />
          </span>
          <strong>{brandConfig.name}</strong>
        </button>
        {canToggle ? (
          <button
            type="button"
            className="global-sidebar-toggle"
            aria-label={isCompact ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!isCompact}
            title={isCompact ? "Expand sidebar" : "Collapse sidebar"}
            onClick={toggleCollapsed}
          >
            <AppIcon name="chevronRight" size="md" className={`global-sidebar-toggle__icon${isCompact ? "" : " is-expanded"}`} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <nav className="global-sidebar-primary" aria-label="Main navigation">
        {primaryGlobalNavigationItems.map((item) => {
          const disabled = item.status(availability) === "unavailable";
          if (item.key === "communities") {
            return (
              <GlobalCommunitiesNav
                key={item.key}
                compact={isCompact}
                active={activeRoute === "communities"}
                disabled={disabled}
                badge={item.badgeSelector(badges)}
                communities={communities}
                activeCommunityId={activeCommunityId}
                onOpenCommunities={() => handleNavigate("communities")}
                onSelectCommunity={handleSelectCommunity}
              />
            );
          }
          return <GlobalNavItem key={item.key} item={item} active={activeRoute === item.key} compact={isCompact} disabled={disabled} badge={item.badgeSelector(badges)} onClick={() => handleNavigate(item.key as GlobalNavigationKey)} />;
        })}
      </nav>

      <div className="global-sidebar-bottom">
        <nav className="global-sidebar-utilities" aria-label="Application utilities">
          {utilityGlobalNavigationItems.map((item) => {
            if (item.key === "settings") {
              return (
                <GlobalSettingsNav
                  key={item.key}
                  compact={isCompact}
                  settingsOpen={settingsOpen || activeUtility === "settings"}
                  activeSection={activeSettingsSection}
                  onOpenSection={(section) => onOpenSettings(section)}
                />
              );
            }
            return (
              <GlobalNavItem
                key={item.key}
                item={item}
                active={activeUtility === item.key}
                compact={isCompact}
                disabled={false}
                badge={null}
                onClick={onOpenHelpSupport}
              />
            );
          })}
        </nav>

        {panelAccessStatus && onOpenPanel ? (
          <PanelEntryButton compact={isCompact} active={isPanelActive} accessStatus={panelAccessStatus} onOpen={onOpenPanel} />
        ) : null}

        <GlobalUserCard currentUser={currentUser} compact={isCompact} onOpenProfile={onOpenProfile} onOpenUserMenu={onOpenUserMenu} />
      </div>
    </aside>
  );
}
