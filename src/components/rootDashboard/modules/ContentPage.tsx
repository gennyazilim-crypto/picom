import type { AdminOperationsAccess } from "../../../services/adminOperationsService";
import { AdminOperationsPagedList } from "../../AdminOperationsV2Sections";
import { RootDashboardModuleListPage } from "./RootDashboardModuleListPage";

type ContentPageProps = Readonly<{ access: AdminOperationsAccess }>;

export function ContentPage({ access }: ContentPageProps) {
  return (
    <>
      <RootDashboardModuleListPage
        access={access}
        section="content_reports"
        title="Content & Feed"
        purpose="Content report queues from the root dashboard module contract. Feed ranking ops remain separate."
        emptyMessage="No content reports returned for this module."
      />
      <section className="rd-page" aria-label="Legacy admin reports">
        <header className="rd-page-head">
          <div>
            <h2>Admin reports list</h2>
            <p>Authorized metadata from adminOperationsService.listSection("reports").</p>
          </div>
        </header>
        <AdminOperationsPagedList access={access} section="reports" />
      </section>
    </>
  );
}
