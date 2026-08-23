import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "../../../i18n";
import type { AdminOperationsAccess } from "../../../services/adminOperationsService";
import { rootDashboardOperationsService } from "../../../services/rootDashboard/rootDashboardOperationsService";
import type { RootDashboardListItem, RootDashboardModuleSection, RootDashboardModuleSummaryKind } from "../../../types/rootDashboardOperations";
import { DashboardState } from "../components/DashboardState";
import { DataTable, StatusPill } from "../components/DataTable";
import { KpiCard } from "../components/KpiCard";
import { ModulePageHeader } from "./moduleScaffold";

type RootDashboardModuleListPageProps = Readonly<{
  access: AdminOperationsAccess;
  section: RootDashboardModuleSection;
  title: string;
  purpose: string;
  summary?: Readonly<Record<string, number>>;
  summaryLabels?: Readonly<Record<string, string>>;
  summaryModule?: RootDashboardModuleSummaryKind;
  emptyMessage?: string;
  toolbar?: ReactNode;
  reloadToken?: number | string;
}>;

export function RootDashboardModuleListPage({
  access,
  section,
  title,
  purpose,
  summary: summaryProp,
  summaryLabels,
  summaryModule,
  emptyMessage,
  toolbar,
  reloadToken = 0,
}: RootDashboardModuleListPageProps) {
  const { t } = useTranslation("admin");
  const [rows, setRows] = useState<RootDashboardListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Readonly<Record<string, number>> | undefined>(summaryProp);

  useEffect(() => {
    if (!summaryModule) return;
    let cancelled = false;
    void rootDashboardOperationsService.getModuleSummary(summaryModule, access).then((result) => {
      if (cancelled) return;
      if (result.ok) setSummary(result.data);
    });
    return () => { cancelled = true; };
  }, [access, summaryModule, reloadToken]);

  useEffect(() => {
    if (summaryProp) setSummary(summaryProp);
  }, [summaryProp]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void rootDashboardOperationsService.listModule(section, access).then((result) => {
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
  }, [access, section, reloadToken]);

  const summaryEntries = summary ? Object.entries(summary) : [];

  return (
    <section className="rd-module" aria-label={title}>
      <ModulePageHeader title={title} purpose={purpose} />
      {summaryEntries.length > 0 ? (
        <div className="rd-kpi-strip" aria-label={t("module.summaryLabel", { module: title })}>
          {summaryEntries.map(([key, value]) => (
            <KpiCard
              key={key}
              label={summaryLabels?.[key] ?? key.replace(/_/g, " ")}
              value={value}
              variant={/urgent|open|pending|alert|critical/i.test(key) && value > 0 ? "warning" : "standard"}
            />
          ))}
        </div>
      ) : null}
      {toolbar ? <div className="rd-module__toolbar">{toolbar}</div> : null}
      {error ? <DashboardState tone="error" detail={error} /> : (
        <DataTable
          loading={loading}
          rows={rows}
          emptyMessage={emptyMessage ?? t("module.noRows")}
          density="compact"
          columns={[
            { id: "label", header: t("table.column.label"), render: (row) => <strong className="rd-table__primary">{row.label}</strong> },
            { id: "detail", header: t("table.column.detail"), render: (row) => <span className="rd-table__muted">{row.detail}</span> },
            { id: "status", header: t("table.column.status"), render: (row) => <StatusPill value={row.status} /> },
            { id: "createdAt", header: t("table.column.updated"), render: (row) => <span className="rd-table__muted">{new Date(row.createdAt).toLocaleString()}</span> },
          ]}
        />
      )}
    </section>
  );
}
