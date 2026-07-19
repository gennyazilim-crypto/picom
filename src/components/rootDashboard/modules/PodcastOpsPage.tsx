import type { AdminOperationsAccess } from "../../../services/adminOperationsService";
import { RootDashboardModuleListPage } from "./RootDashboardModuleListPage";

type ModulePageProps = Readonly<{ access: AdminOperationsAccess }>;

export function PodcastOpsPage({ access }: ModulePageProps) {
  return (
    <RootDashboardModuleListPage
      access={access}
      section="podcast_shows"
      title="Podcast Operations"
      purpose="Show catalog, publish state, and episode operations for root operators."
      emptyMessage="No podcast shows returned for this admin list."
    />
  );
}
