import type { AdminOperationsAccess } from "../../../services/adminOperationsService";
import { ModulePageHeader } from "./moduleScaffold";

type DashboardSettingsPageProps = Readonly<{ access: AdminOperationsAccess }>;

export function DashboardSettingsPage({ access }: DashboardSettingsPageProps) {
  return (
    <section className="rd-page" aria-label="Dashboard settings">
      <ModulePageHeader
        title="Dashboard Settings"
        purpose="Panel access provenance and operator references. Preference persistence remains local until a settings contract ships."
      />
      <div className="rd-mutation-form">
        <div className="rd-mutation-form__head">
          <strong>Access source</strong>
        </div>
        <div className="rd-mutation-form__fields">
          <p style={{ margin: 0, fontSize: 13 }}>
            Current Panel grant: <code>{access.source}</code>
            {access.allowed ? " (allowed)" : " (denied)"}
          </p>
          <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
            Visibility alone is not security. Mutations still require live app-admin RPC authorization.
          </p>
        </div>
      </div>
      <div className="rd-mutation-form">
        <div className="rd-mutation-form__head">
          <strong>Documentation</strong>
        </div>
        <div className="rd-mutation-form__fields">
          <code>docs/root-dashboard/ASTRAL_ADMIN_REFERENCE.md</code>
          <code>docs/root-dashboard/ROOT_OWNER_CLAUDE_TASKS_PROGRESS.md</code>
          <code>docs/root-dashboard/ROOT_DASHBOARD_TASK_COMPLETION.md</code>
        </div>
      </div>
    </section>
  );
}
