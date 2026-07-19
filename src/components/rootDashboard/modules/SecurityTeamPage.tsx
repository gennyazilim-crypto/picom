import type { AdminOperationsAccess } from "../../../services/adminOperationsService";
import { RootDashboardModuleListPage } from "./RootDashboardModuleListPage";

type ModulePageProps = Readonly<{ access: AdminOperationsAccess }>;

export function SecurityTeamPage({ access }: ModulePageProps) {
  return (
    <RootDashboardModuleListPage
      access={access}
      section="security_team"
      title="Security Team"
      purpose="Security staffing and SOC role assignments."
      emptyMessage="No active security team assignments."
    />
  );
}
