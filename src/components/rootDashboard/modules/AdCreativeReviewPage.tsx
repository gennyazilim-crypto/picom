import type { AdminOperationsAccess } from "../../../services/adminOperationsService";
import { useTranslation } from "../../../i18n";
import { RootDashboardModuleListPage } from "./RootDashboardModuleListPage";

type ModulePageProps = Readonly<{ access: AdminOperationsAccess }>;

export function AdCreativeReviewPage({ access }: ModulePageProps) {
  const { t } = useTranslation("admin");
  return (
    <RootDashboardModuleListPage
      access={access}
      section="ad_creative_review"
      title={t("module.adCreativeReview.title")}
      purpose={t("module.adCreativeReview.purpose")}
      emptyMessage={t("module.adCreativeReview.empty")}
    />
  );
}
