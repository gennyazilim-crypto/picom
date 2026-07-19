import type { ReactNode } from "react";
import { DashboardState } from "../components/DashboardState";
import { DataTable } from "../components/DataTable";

type ModulePageHeaderProps = Readonly<{
  title: string;
  purpose: string;
}>;

export function ModulePageHeader({ title, purpose }: ModulePageHeaderProps) {
  return (
    <header className="rd-module__header">
      <h2>{title}</h2>
      <p>{purpose}</p>
    </header>
  );
}

type ScaffoldRow = Readonly<{ id: string; label: string; status: string; updated: string }>;

const EMPTY_COLUMNS = [
  { id: "label", header: "Label", accessor: (row: ScaffoldRow) => row.label },
  { id: "status", header: "Status", accessor: (row: ScaffoldRow) => row.status },
  { id: "updated", header: "Updated", accessor: (row: ScaffoldRow) => row.updated },
] as const;

type UnavailableModuleProps = Readonly<{
  title: string;
  purpose: string;
  reason?: string;
  children?: ReactNode;
}>;

export function UnavailableModulePage({
  title,
  purpose,
  reason = "Contract not deployed yet",
  children,
}: UnavailableModuleProps) {
  return (
    <section className="rd-module" aria-label={title}>
      <ModulePageHeader title={title} purpose={purpose} />
      <DashboardState
        variant="empty"
        title={`${title} unavailable`}
        message={reason}
      />
      {children ?? (
        <DataTable<ScaffoldRow>
          columns={EMPTY_COLUMNS}
          rows={[]}
          emptyMessage="No authorized rows. Backend list contract is not deployed for this module."
        />
      )}
    </section>
  );
}
