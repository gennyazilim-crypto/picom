import type { AdminOperationsAccess } from "../../../services/adminOperationsService";
import { useTranslation } from "../../../i18n";
import { RootDashboardModuleListPage } from "./RootDashboardModuleListPage";

type ModulePageProps = Readonly<{ access: AdminOperationsAccess }>;

export function PodcastOpsPage({ access }: ModulePageProps) {
  const { t } = useTranslation("admin");
  return (
    <RootDashboardModuleListPage
      access={access}
      section="podcast_shows"
      title={t("module.podcast.title")}
      purpose={t("module.podcast.purpose")}
      emptyMessage={t("module.podcast.empty")}
    />
  );
}
