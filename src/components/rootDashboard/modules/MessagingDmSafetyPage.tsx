import type { AdminOperationsAccess } from "../../../services/adminOperationsService";
import { RootDashboardModuleListPage } from "./RootDashboardModuleListPage";

type ModulePageProps = Readonly<{ access: AdminOperationsAccess }>;

export function MessagingDmSafetyPage({ access }: ModulePageProps) {
  return (
    <RootDashboardModuleListPage
      access={access}
      section="dm_safety_reports"
      title="DM Safety"
      purpose="Direct-message safety reports and queue triage for root operators."
      emptyMessage="No DM safety reports returned."
    />
  );
}
