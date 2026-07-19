import type { AdminOperationsAccess } from "../../../services/adminOperationsService";
import { RootDashboardModuleListPage } from "./RootDashboardModuleListPage";

type ModulePageProps = Readonly<{ access: AdminOperationsAccess }>;

export function AdCreativeReviewPage({ access }: ModulePageProps) {
  return (
    <RootDashboardModuleListPage
      access={access}
      section="ad_creative_review"
      title="Ad Creative Review"
      purpose="Brand safety and creative moderation queue."
      emptyMessage="No creatives awaiting review."
    />
  );
}
