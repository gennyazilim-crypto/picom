import type { AdminOperationsAccess } from "../../../services/adminOperationsService";
import { useTranslation } from "../../../i18n";
import { RootDashboardModuleListPage } from "./RootDashboardModuleListPage";

type ModulePageProps = Readonly<{ access: AdminOperationsAccess }>;

export function MessagingDmSafetyPage({ access }: ModulePageProps) {
  const { t } = useTranslation("admin");
  return (
    <RootDashboardModuleListPage
      access={access}
      section="dm_safety_reports"
      title={t("module.messaging.title")}
      purpose={t("module.messaging.purpose")}
      emptyMessage={t("module.messaging.empty")}
    />
  );
}
