import { useEffect, useState } from "react";
import type { AdminOperationsAccess } from "../../../services/adminOperationsService";
import { adminOperationsService } from "../../../services/adminOperationsService";
import type { AdminOperationsListItem } from "../../../types/adminOperations";
import { DashboardState } from "../components/DashboardState";
import { DataTable } from "../components/DataTable";

type CommunitiesPageProps = Readonly<{ access: AdminOperationsAccess }>;

export function CommunitiesPage({ access }: CommunitiesPageProps) {
  const [rows, setRows] = useState<AdminOperationsListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void adminOperationsService.listSection("communities", access).then((result) => {
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
  }, [access]);

  return (
    <section className="rd-page">
      <header className="rd-page-head">
        <div>
          <h2>Communities</h2>
          <p>Root community list with health/status cues when available.</p>
        </div>
      </header>
      {error ? <DashboardState tone="error" detail={error} /> : (
        <DataTable
          loading={loading}
          rows={rows}
          emptyMessage="No communities returned for this admin list."
          columns={[
            { id: "label", header: "Community", render: (row) => row.label },
            { id: "detail", header: "Detail", render: (row) => row.detail },
            { id: "status", header: "Visibility", render: (row) => row.status },
            { id: "createdAt", header: "Seen", render: (row) => new Date(row.createdAt).toLocaleString() },
          ]}
        />
      )}
    </section>
  );
}
