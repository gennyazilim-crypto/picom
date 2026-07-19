import type { AdminOperationsAccess } from "../../../services/adminOperationsService";
import { RootDashboardModuleListPage } from "./RootDashboardModuleListPage";

type ModulePageProps = Readonly<{ access: AdminOperationsAccess }>;

export function AdvertisingTeamPage({ access }: ModulePageProps) {
  return (
    <RootDashboardModuleListPage
      access={access}
      section="advertising_team"
      title="Advertising Team"
      purpose="Ads staffing, campaign ownership, and review assignments."
      emptyMessage="No active advertising team assignments."
    />
  );
}
