import type { AdminOperationsAccess } from "../../../services/adminOperationsService";
import { RootDashboardModuleListPage } from "./RootDashboardModuleListPage";

type ModulePageProps = Readonly<{ access: AdminOperationsAccess }>;

export function RevenuePage({ access }: ModulePageProps) {
  return (
    <RootDashboardModuleListPage
      access={access}
      section="subscriptions"
      title="Revenue & Subscriptions"
      purpose="Subscription health, plan mixes, and revenue snapshots."
      summaryModule="revenue"
      summaryLabels={{
        active_subscriptions: "Active subscriptions",
        past_due: "Past due",
        canceled_30d: "Canceled / 30d",
        mrr_cents: "MRR (cents)",
      }}
      emptyMessage="No subscription records synced yet."
    />
  );
}
