import type { AdminOperationsAccess } from "../../../services/adminOperationsService";
import { RootDashboardModuleListPage } from "./RootDashboardModuleListPage";

type ModulePageProps = Readonly<{ access: AdminOperationsAccess }>;

export function SecurityOpsPage({ access }: ModulePageProps) {
  return (
    <RootDashboardModuleListPage
      access={access}
      section="security_alerts"
      title="Security Operations"
      purpose="Security event triage, ATO signals, and SOC queues."
      emptyMessage="No high/critical security alerts in the last 7 days."
    />
  );
}
