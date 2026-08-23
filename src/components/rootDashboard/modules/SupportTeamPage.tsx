import type { AdminOperationsAccess } from "../../../services/adminOperationsService";
import { useTranslation } from "../../../i18n";
import { RootDashboardModuleListPage } from "./RootDashboardModuleListPage";

type ModulePageProps = Readonly<{ access: AdminOperationsAccess }>;

export function SupportTeamPage({ access }: ModulePageProps) {
  const { t } = useTranslation("admin");
  return (
    <RootDashboardModuleListPage
      access={access}
      section="support_team"
      title={t("module.supportTeam.title")}
      purpose={t("module.supportTeam.purpose")}
      emptyMessage={t("module.supportTeam.empty")}
    />
  );
}
