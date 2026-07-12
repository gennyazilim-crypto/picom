import type { MouseEvent, ReactNode } from "react";
import type { Member } from "../../types/community";
import type { GlobalNavigationAvailability, GlobalNavigationBadgeState, GlobalNavigationKey, GlobalUtilityKey } from "../../types/globalNavigation";
import { AppWorkspaceRouter } from "./AppWorkspaceRouter";
import { GlobalAppSidebar } from "./GlobalAppSidebar";

type AuthenticatedAppShellProps = Readonly<{
  activeRoute: GlobalNavigationKey | null;
  activeUtility?: GlobalUtilityKey | null;
  badges: GlobalNavigationBadgeState;
  availability: GlobalNavigationAvailability;
  currentUser: Member;
  children: ReactNode;
  onNavigate: (route: GlobalNavigationKey) => void;
  onOpenSettings: () => void;
  onOpenHelpSupport: () => void;
  onOpenProfile: () => void;
  onOpenUserMenu: (event: MouseEvent<HTMLButtonElement>) => void;
}>;

export function AuthenticatedAppShell(props: AuthenticatedAppShellProps) {
  const { children, activeRoute, activeUtility = null, ...sidebarProps } = props;
  return (
    <div className="authenticated-app-shell">
      <GlobalAppSidebar activeRoute={activeRoute} activeUtility={activeUtility} {...sidebarProps} />
      <AppWorkspaceRouter activeRoute={activeRoute}>{children}</AppWorkspaceRouter>
    </div>
  );
}
