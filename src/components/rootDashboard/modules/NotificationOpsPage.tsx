import type { AdminOperationsAccess } from "../../../services/adminOperationsService";
import { useTranslation } from "../../../i18n";
import { RootDashboardModuleListPage } from "./RootDashboardModuleListPage";

type ModulePageProps = Readonly<{ access: AdminOperationsAccess }>;

export function NotificationOpsPage({ access }: ModulePageProps) {
  const { t } = useTranslation("admin");
  return (
    <RootDashboardModuleListPage
      access={access}
      section="notifications_ops"
      title={t("module.notifications.title")}
      purpose={t("module.notifications.purpose")}
      emptyMessage={t("module.notifications.empty")}
    />
  );
}
