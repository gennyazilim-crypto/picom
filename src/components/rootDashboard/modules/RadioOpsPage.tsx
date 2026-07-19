import type { AdminOperationsAccess } from "../../../services/adminOperationsService";
import { RootDashboardModuleListPage } from "./RootDashboardModuleListPage";

type ModulePageProps = Readonly<{ access: AdminOperationsAccess }>;

export function RadioOpsPage({ access }: ModulePageProps) {
  return (
    <RootDashboardModuleListPage
      access={access}
      section="radio_sessions"
      title="Radio Operations"
      purpose="Live and scheduled radio sessions, hosts, and session health."
      emptyMessage="No radio sessions returned for this admin list."
    />
  );
}
