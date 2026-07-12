import type { ReactNode } from "react";
import type { GlobalNavigationKey } from "../../types/globalNavigation";

export function AppWorkspaceRouter({ activeRoute, children }: { activeRoute: GlobalNavigationKey | null; children: ReactNode }) {
  return <section className="app-workspace-router" data-global-route={activeRoute ?? "contextual"}>{children}</section>;
}
