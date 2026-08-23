import type { AdminOperationsAccess } from "../../../services/adminOperationsService";
import { useTranslation } from "../../../i18n";
import { RootDashboardModuleListPage } from "./RootDashboardModuleListPage";

type ModulePageProps = Readonly<{ access: AdminOperationsAccess }>;

export function ModerationTeamPage({ access }: ModulePageProps) {
  const { t } = useTranslation("admin");
  return (
    <RootDashboardModuleListPage
      access={access}
      section="moderation_team"
      title={t("module.moderationTeam.title")}
      purpose={t("module.moderationTeam.purpose")}
      emptyMessage={t("module.moderationTeam.empty")}
    />
  );
}
