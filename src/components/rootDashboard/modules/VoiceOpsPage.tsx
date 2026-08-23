import type { AdminOperationsAccess } from "../../../services/adminOperationsService";
import { useTranslation } from "../../../i18n";
import { RootDashboardModuleListPage } from "./RootDashboardModuleListPage";

type ModulePageProps = Readonly<{ access: AdminOperationsAccess }>;

export function VoiceOpsPage({ access }: ModulePageProps) {
  const { t } = useTranslation("admin");
  return (
    <RootDashboardModuleListPage
      access={access}
      section="voice_rooms"
      title={t("module.voice.title")}
      purpose={t("module.voice.purpose")}
      emptyMessage={t("module.voice.empty")}
    />
  );
}
