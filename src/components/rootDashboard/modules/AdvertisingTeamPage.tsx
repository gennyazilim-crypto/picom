import type { AdminOperationsAccess } from "../../../services/adminOperationsService";
import { useTranslation } from "../../../i18n";
import { RootDashboardModuleListPage } from "./RootDashboardModuleListPage";

type ModulePageProps = Readonly<{ access: AdminOperationsAccess }>;

export function AdvertisingTeamPage({ access }: ModulePageProps) {
  const { t } = useTranslation("admin");
  return (
    <RootDashboardModuleListPage
      access={access}
      section="advertising_team"
      title={t("module.advertisingTeam.title")}
      purpose={t("module.advertisingTeam.purpose")}
      emptyMessage={t("module.advertisingTeam.empty")}
    />
  );
}
