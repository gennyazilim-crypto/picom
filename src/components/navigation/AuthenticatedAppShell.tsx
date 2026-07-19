import type { MouseEvent, ReactNode } from "react";
import type { Community, Member } from "../../types/community";
import type { GlobalNavigationAvailability, GlobalNavigationBadgeState, GlobalNavigationKey, GlobalUtilityKey } from "../../types/globalNavigation";
import type { UserSettingsSection } from "../../services/navigation/settingsNavigationPolicyService";
import { AppWorkspaceRouter } from "./AppWorkspaceRouter";
import { GlobalAppSidebar } from "./GlobalAppSidebar";
import "./globalNavigation.css";

type AuthenticatedAppShellProps = Readonly<{
  activeRoute: GlobalNavigationKey | null;
  activeUtility?: GlobalUtilityKey | null;
  badges: GlobalNavigationBadgeState;
  availability: GlobalNavigationAvailability;
  currentUser: Member;
  communities?: readonly Community[];
  activeCommunityId?: string | null;
  onSelectCommunity?: (communityId: string) => void;
  children: ReactNode;
  settingsOpen?: boolean;
  activeSettingsSection?: UserSettingsSection | null;
  onNavigate: (route: GlobalNavigationKey) => void;
  onOpenSettings: (section?: UserSettingsSection) => void;
  onOpenHelpSupport: () => void;
  onOpenProfile: () => void;
  onOpenUserMenu: (event: MouseEvent<HTMLButtonElement>) => void;
  panelAccessStatus?: import("../../services/rootDashboard/rootDashboardAccessService").RootDashboardAccessStatus;
  onOpenPanel?: () => void;
  isPanelActive?: boolean;
}>;

export function AuthenticatedAppShell(props: AuthenticatedAppShellProps) {
  const { children, activeRoute, activeUtility = null, isPanelActive = false, ...sidebarProps } = props;

  // Root Panel is a full-workspace takeover: hide GlobalAppSidebar so it cannot peek
  // through (labels crushed in a thin column / Settings bleeding under Panel chrome).
  if (isPanelActive) {
    return (
      <div className="authenticated-app-shell is-panel-mode" data-shell-mode="panel">
        <AppWorkspaceRouter activeRoute={null}>{children}</AppWorkspaceRouter>
      </div>
    );
  }

  return (
    <div className="authenticated-app-shell" data-shell-mode="app">
      <GlobalAppSidebar activeRoute={activeRoute} activeUtility={activeUtility} {...sidebarProps} />
      <AppWorkspaceRouter activeRoute={activeRoute}>{children}</AppWorkspaceRouter>
    </div>
  );
}
