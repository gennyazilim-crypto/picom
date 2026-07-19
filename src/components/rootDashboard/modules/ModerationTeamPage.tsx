import type { AdminOperationsAccess } from "../../../services/adminOperationsService";
import { RootDashboardModuleListPage } from "./RootDashboardModuleListPage";

type ModulePageProps = Readonly<{ access: AdminOperationsAccess }>;

export function ModerationTeamPage({ access }: ModulePageProps) {
  return (
    <RootDashboardModuleListPage
      access={access}
      section="moderation_team"
      title="Moderation Team"
      purpose="Trust & Safety staffing and moderation assignments."
      emptyMessage="No active moderation team assignments."
    />
  );
}
