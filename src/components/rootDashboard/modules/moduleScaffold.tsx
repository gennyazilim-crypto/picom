import type { ReactNode } from "react";
import { useTranslation, type TFunction } from "../../../i18n";
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

function emptyColumns(t: TFunction) {
  return [
    { id: "label", header: t("table.column.label"), accessor: (row: ScaffoldRow) => row.label },
    { id: "status", header: t("table.column.status"), accessor: (row: ScaffoldRow) => row.status },
    { id: "updated", header: t("table.column.updated"), accessor: (row: ScaffoldRow) => row.updated },
  ] as const;
}

type UnavailableModuleProps = Readonly<{
  title: string;
  purpose: string;
  reason?: string;
  children?: ReactNode;
}>;

export function UnavailableModulePage({
  title,
  purpose,
  reason,
  children,
}: UnavailableModuleProps) {
  const { t } = useTranslation("admin");
  return (
    <section className="rd-module" aria-label={title}>
      <ModulePageHeader title={title} purpose={purpose} />
      <DashboardState
        variant="empty"
        title={t("module.unavailableTitle", { module: title })}
        message={reason ?? t("module.contractNotDeployed")}
      />
      {children ?? (
        <DataTable<ScaffoldRow>
          columns={emptyColumns(t)}
          rows={[]}
          emptyMessage={t("module.noAuthorizedRows")}
        />
      )}
    </section>
  );
}
