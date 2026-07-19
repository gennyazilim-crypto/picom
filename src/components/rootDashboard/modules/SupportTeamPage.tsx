import type { AdminOperationsAccess } from "../../../services/adminOperationsService";
import { RootDashboardModuleListPage } from "./RootDashboardModuleListPage";

type ModulePageProps = Readonly<{ access: AdminOperationsAccess }>;

export function SupportTeamPage({ access }: ModulePageProps) {
  return (
    <RootDashboardModuleListPage
      access={access}
      section="support_team"
      title="Support Team"
      purpose="Support staffing, shifts, and team assignment controls."
      emptyMessage="No active support team assignments."
    />
  );
}
