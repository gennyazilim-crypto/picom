import type { AdminOperationsAccess } from "../../../services/adminOperationsService";
import { RootDashboardModuleListPage } from "./RootDashboardModuleListPage";

type ModulePageProps = Readonly<{ access: AdminOperationsAccess }>;

export function NotificationOpsPage({ access }: ModulePageProps) {
  return (
    <RootDashboardModuleListPage
      access={access}
      section="notifications_ops"
      title="Notification Operations"
      purpose="Delivery queues, digest jobs, and push/email ops visibility."
      emptyMessage="No notification operations rows returned."
    />
  );
}
