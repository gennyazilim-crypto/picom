import type { AdminOperationsAccess } from "../../../services/adminOperationsService";
import { useTranslation } from "../../../i18n";
import { RootDashboardModuleListPage } from "./RootDashboardModuleListPage";

type ModulePageProps = Readonly<{ access: AdminOperationsAccess }>;

export function SecurityTeamPage({ access }: ModulePageProps) {
  const { t } = useTranslation("admin");
  return (
    <RootDashboardModuleListPage
      access={access}
      section="security_team"
      title={t("module.securityTeam.title")}
      purpose={t("module.securityTeam.purpose")}
      emptyMessage={t("module.securityTeam.empty")}
    />
  );
}
