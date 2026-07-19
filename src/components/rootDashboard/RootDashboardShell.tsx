import { useEffect, useMemo, useState, type ReactNode } from "react";
import { appConfig } from "../../config/appConfig";
import { brandConfig } from "../../config/brandConfig";
import { brandLogoUrl } from "../../config/brandAssets";
import { networkStatusService, type NetworkState } from "../../services/networkStatusService";
import { AppIcon } from "../AppIcon";
import {
  ROOT_DASHBOARD_NAV_GROUPS,
  findRootDashboardNavItem,
  type RootDashboardRouteKey,
} from "./navigation/rootDashboardNav";

export type RootDashboardShellUser = Readonly<{
  displayName: string;
  username: string;
  email?: string;
}>;

export type RootDashboardConnectionStatus = NetworkState | "unknown";

type RootDashboardShellProps = Readonly<{
  currentUser: RootDashboardShellUser;
  activeRoute: RootDashboardRouteKey;
  onNavigate: (route: RootDashboardRouteKey) => void;
  onClose?: () => void;
  onExit?: () => void;
  onOpenCommandCenter: () => void;
  children: ReactNode;
  filterBar?: ReactNode;
  connectionStatus?: RootDashboardConnectionStatus;
  compact?: boolean;
}>;

function realtimeTone(state: RootDashboardConnectionStatus): "online" | "offline" | "degraded" {
  if (state === "online") return "online";
  if (state === "offline" || state === "backend_unreachable") return "offline";
  return "degraded";
}

function realtimeLabel(state: RootDashboardConnectionStatus): string {
  if (state === "online") return "Live";
  if (state === "backend_unreachable") return "Backend down";
  if (state === "offline") return "Offline";
  if (state === "unknown") return "Checking";
  return String(state).replace(/_/g, " ");
}

function envLabel(environment: string): string {
  if (environment === "production") return "Prod";
  if (environment === "staging") return "Staging";
  if (environment === "development") return "Dev";
  return environment;
}

export function RootDashboardShell({
  currentUser,
  activeRoute,
  onNavigate,
  onClose,
  onExit,
  onOpenCommandCenter,
  children,
  filterBar,
  connectionStatus,
  compact = false,
}: RootDashboardShellProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [networkState, setNetworkState] = useState<RootDashboardConnectionStatus>(
    () => connectionStatus ?? networkStatusService.getSnapshot().state,
  );

  useEffect(() => {
    if (connectionStatus) {
      setNetworkState(connectionStatus);
      return;
    }
    setNetworkState(networkStatusService.getSnapshot().state);
    return networkStatusService.subscribe((snapshot) => setNetworkState(snapshot.state));
  }, [connectionStatus]);

  const activeItem = useMemo(() => findRootDashboardNavItem(activeRoute), [activeRoute]);
  const exit = onExit ?? onClose;
  const tone = realtimeTone(networkState);
  const commandChord = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K";

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((current) => ({ ...current, [groupId]: !current[groupId] }));
  };

  return (
    <div className={`root-dashboard${compact ? " is-compact" : ""}`}>
      <div className={`rd-shell${compact ? " is-compact" : ""}`}>
        <aside className="rd-sidebar" aria-label="Root dashboard navigation">
          <div className="rd-sidebar__brand">
            <span className="rd-sidebar__mark" aria-hidden="true">
              <img className="picom-brand-logo" src={brandLogoUrl} alt="" width={28} height={28} decoding="async" />
            </span>
            {compact ? null : (
              <div className="rd-sidebar__brand-copy">
                <strong>{brandConfig.name} Panel</strong>
                <span>Operations</span>
              </div>
            )}
            {exit ? (
              <button type="button" className="rd-header__exit" aria-label="Close Panel" onClick={exit}>
                <AppIcon name="close" size="sm" />
              </button>
            ) : null}
          </div>
          <nav className="rd-sidebar__scroll">
            {ROOT_DASHBOARD_NAV_GROUPS.map((group) => {
              const collapsed = Boolean(collapsedGroups[group.id]);
              return (
                <div key={group.id} className="rd-nav-group">
                  <button
                    type="button"
                    className="rd-nav-group__label"
                    aria-expanded={!collapsed}
                    onClick={() => toggleGroup(group.id)}
                  >
                    <span>{group.label}</span>
                    <AppIcon name={collapsed ? "chevronRight" : "chevronDown"} size="xs" />
                  </button>
                  {collapsed ? null : (
                    <ul className="rd-nav-group__items">
                      {group.items.map((item) => (
                        <li key={item.key}>
                          <button
                            type="button"
                            className={`rd-nav-item rd-nav-group__link${activeRoute === item.key ? " is-active" : ""}`}
                            aria-current={activeRoute === item.key ? "page" : undefined}
                            title={compact ? item.label : undefined}
                            onClick={() => onNavigate(item.key)}
                          >
                            <AppIcon name={item.icon} size="sm" aria-hidden="true" />
                            {compact ? null : <span>{item.label}</span>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </nav>
          <div className="rd-sidebar__foot">
            <button type="button" className="rd-account-menu" aria-label="Root account menu" title={currentUser.email ?? `@${currentUser.username}`}>
              <span className="rd-account-menu__avatar" aria-hidden="true">
                <AppIcon name="user" size="sm" />
              </span>
              {compact ? null : (
                <span className="rd-account-menu__copy">
                  <strong>{currentUser.displayName}</strong>
                  <small>@{currentUser.username}</small>
                </span>
              )}
            </button>
          </div>
        </aside>

        <header className="rd-header">
          <div className="rd-header__title">
            <div className="rd-breadcrumb" aria-label="Breadcrumb">
              <span>Panel</span>
              <AppIcon name="chevronRight" size="xs" />
              <strong>{activeItem?.label ?? activeRoute}</strong>
            </div>
            <span className="rd-header__meta">@{currentUser.username}</span>
          </div>
          <div className="rd-header__actions">
            <button type="button" className="rd-header__command" onClick={onOpenCommandCenter}>
              <AppIcon name="search" size="sm" />
              <span>Command</span>
              <kbd>{commandChord}</kbd>
            </button>
            <span className="rd-env-badge" title={`Environment: ${appConfig.environment}`}>
              {envLabel(appConfig.environment)}
            </span>
            <span className={`rd-realtime is-${tone}`} title={`Network: ${networkState}`}>
              <i className="rd-realtime__dot" aria-hidden="true" />
              {realtimeLabel(networkState)}
            </span>
          </div>
        </header>

        <div className="rd-content">
          {filterBar ? <div className="rd-filter-slot">{filterBar}</div> : null}
          <div className="rd-viewport">{children}</div>
        </div>
      </div>
    </div>
  );
}
