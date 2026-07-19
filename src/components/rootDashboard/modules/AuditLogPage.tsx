import type { AdminOperationsAccess } from "../../../services/adminOperationsService";
import { adminOperationsService } from "../../../services/adminOperationsService";
import { RootDashboardModuleListPage } from "./RootDashboardModuleListPage";

type AuditLogPageProps = Readonly<{ access: AdminOperationsAccess }>;

export function AuditLogPage({ access }: AuditLogPageProps) {
  const snapshot = adminOperationsService.getSnapshot();

  return (
    <section className="rd-page">
      <div className="rd-kpi-grid" style={{ marginBottom: 12 }}>
        <article className="rd-kpi"><span>Recent errors</span><strong>{snapshot.recentErrors.length}</strong></article>
        <article className="rd-kpi"><span>Recent warnings</span><strong>{snapshot.recentWarnings.length}</strong></article>
      </div>
      <RootDashboardModuleListPage
        access={access}
        section="audit_logs"
        title="Audit Logs"
        purpose="Immutable privileged action metadata from admin_operations_audit."
        emptyMessage="No privileged audit events recorded yet."
      />
    </section>
  );
}
