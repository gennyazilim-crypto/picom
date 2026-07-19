import { useEffect, useState } from "react";
import type { AdminOperationsAccess } from "../../../services/adminOperationsService";
import { rootDashboardMutationService } from "../../../services/rootDashboard/rootDashboardMutationService";
import type { RootDashboardListItem } from "../../../types/rootDashboardOperations";
import { DashboardState } from "../components/DashboardState";
import { DataTable } from "../components/DataTable";
import { FieldLabel, ModuleMutationForm } from "./moduleMutationForms";
import { ModulePageHeader } from "./moduleScaffold";

type ReportsExportsPageProps = Readonly<{ access: AdminOperationsAccess }>;

export function ReportsExportsPage({ access }: ReportsExportsPageProps) {
  const [rows, setRows] = useState<RootDashboardListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportType, setExportType] = useState("audit_logs");
  const [format, setFormat] = useState("csv");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void rootDashboardMutationService.listExportJobs(access).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setError(result.message);
        setRows([]);
      } else {
        setRows([...result.data.items]);
        setError(null);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [access, reloadToken]);

  return (
    <section className="rd-page">
      <ModulePageHeader
        title="Reports & Exports"
        purpose="Scheduled reports, CSV/PDF exports, and delivery destinations."
      />
      <div className="rd-mutation-grid">
        <ModuleMutationForm
          title="Create export job"
          submitLabel="Create job"
          onSuccess={() => setReloadToken((value) => value + 1)}
          onSubmit={() => rootDashboardMutationService.createExportJob(access, { exportType, format })}
        >
          <FieldLabel label="Export type">
            <input value={exportType} onChange={(event) => setExportType(event.target.value)} required />
          </FieldLabel>
          <FieldLabel label="Format">
            <select value={format} onChange={(event) => setFormat(event.target.value)}>
              <option value="csv">csv</option>
              <option value="json">json</option>
              <option value="pdf">pdf</option>
            </select>
          </FieldLabel>
        </ModuleMutationForm>
      </div>
      {error ? <DashboardState tone="error" detail={error} /> : (
        <DataTable
          loading={loading}
          rows={rows}
          emptyMessage="No export jobs yet."
          columns={[
            { id: "label", header: "Export", render: (row) => row.label },
            { id: "detail", header: "Detail", render: (row) => row.detail },
            { id: "status", header: "Status", render: (row) => row.status },
            { id: "createdAt", header: "Created", render: (row) => new Date(row.createdAt).toLocaleString() },
          ]}
        />
      )}
    </section>
  );
}
