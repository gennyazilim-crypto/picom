import { useEffect, useState } from "react";
import type { AdminOperationsAccess } from "../../../services/adminOperationsService";
import { adminOperationsService } from "../../../services/adminOperationsService";
import type { AdminOperationsListItem } from "../../../types/adminOperations";
import { DashboardState } from "../components/DashboardState";
import { DataTable } from "../components/DataTable";

type UsersPageProps = Readonly<{ access: AdminOperationsAccess }>;

export function UsersPage({ access }: UsersPageProps) {
  const [rows, setRows] = useState<AdminOperationsListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void adminOperationsService.listSection("users", access).then((result) => {
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
          <h2>Users</h2>
          <p>Restricted admin user directory — no password or session secrets.</p>
        </div>
      </header>
      {error ? <DashboardState tone="error" detail={error} /> : (
        <DataTable
          loading={loading}
          rows={rows}
          emptyMessage="No users returned for this admin list."
          columns={[
            { id: "label", header: "User", render: (row) => row.label },
            { id: "detail", header: "Handle", render: (row) => row.detail },
            { id: "status", header: "Status", render: (row) => row.status },
            { id: "createdAt", header: "Seen", render: (row) => new Date(row.createdAt).toLocaleString() },
          ]}
        />
      )}
    </section>
  );
}
