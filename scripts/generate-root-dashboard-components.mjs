import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const w = (rel, content) => {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content.replace(/\r?\n/g, "\n"), "utf8");
  console.log("wrote", rel);
};

w("src/components/rootDashboard/components/DashboardState.tsx", `type DashboardStateProps = Readonly<{
  tone: "loading" | "empty" | "error" | "noPermission" | "reconnect";
  title?: string;
  detail?: string;
  onRetry?: () => void;
}>;

const copy: Record<DashboardStateProps["tone"], { title: string; detail: string }> = {
  loading: { title: "Loading", detail: "Resolving live dashboard data…" },
  empty: { title: "Nothing here yet", detail: "No rows match the current filters." },
  error: { title: "Could not load", detail: "The data contract failed or timed out." },
  noPermission: { title: "No Panel access", detail: "This root dashboard is limited to authorized app admins. Visibility alone is not security." },
  reconnect: { title: "Connection interrupted", detail: "Realtime or network status is degraded. Retry when connectivity returns." },
};

export function DashboardState({ tone, title, detail, onRetry }: DashboardStateProps) {
  const fallback = copy[tone];
  return (
    <div className={\`rd-state is-\${tone}\`} role="status" aria-live="polite">
      <strong>{title ?? fallback.title}</strong>
      <p>{detail ?? fallback.detail}</p>
      {onRetry ? <button type="button" onClick={onRetry}>Retry</button> : null}
    </div>
  );
}
`);

w("src/components/rootDashboard/components/KpiCard.tsx", `type KpiVariant = "standard" | "realtime" | "warning" | "trend" | "ratio" | "progress" | "stale";

type KpiCardProps = Readonly<{
  label: string;
  value?: number | string | null;
  previousValue?: number | null;
  unit?: string;
  trendPercent?: number | null;
  freshnessIso?: string | null;
  definition?: string;
  loading?: boolean;
  unavailableReason?: string;
  variant?: KpiVariant;
  onDrillDown?: () => void;
}>;

function formatValue(value: number | string | null | undefined, unit?: string) {
  if (value === null || value === undefined || value === "") return "—";
  const base = typeof value === "number" ? new Intl.NumberFormat().format(value) : value;
  return unit ? \`\${base} \${unit}\` : base;
}

export function KpiCard({
  label,
  value,
  previousValue,
  unit,
  trendPercent,
  freshnessIso,
  definition,
  loading,
  unavailableReason,
  variant = "standard",
  onDrillDown,
}: KpiCardProps) {
  const unavailable = !loading && (value === null || value === undefined);
  const aria = definition ? \`\${label}. \${definition}\` : label;
  const className = [
    "rd-kpi",
    \`is-\${variant}\`,
    loading ? "is-skeleton" : "",
    unavailable ? "is-unavailable" : "",
  ].filter(Boolean).join(" ");

  const content = (
    <>
      <span>{label}</span>
      <strong>{loading ? "••••" : formatValue(value, unit)}</strong>
      {unavailable ? <em>{unavailableReason ?? "Unavailable"}</em> : null}
      {!unavailable && typeof trendPercent === "number" ? (
        <em className={\`rd-kpi__trend \${trendPercent >= 0 ? "up" : "down"}\`}>
          {trendPercent >= 0 ? "+" : ""}{trendPercent.toFixed(1)}% vs prior
        </em>
      ) : null}
      {!unavailable && previousValue != null && trendPercent == null ? (
        <em>Prior: {formatValue(previousValue, unit)}</em>
      ) : null}
      {freshnessIso ? <em>As of {new Date(freshnessIso).toLocaleString()}</em> : null}
    </>
  );

  if (onDrillDown) {
    return (
      <button type="button" className={className} aria-label={aria} title={definition} onClick={onDrillDown}>
        {content}
      </button>
    );
  }

  return (
    <article className={className} aria-label={aria} title={definition}>
      {content}
    </article>
  );
}
`);

w("src/components/rootDashboard/components/DashboardChart.tsx", `type ChartKind = "line" | "area" | "bar" | "stackedBar" | "donut" | "funnel" | "heatmap" | "timeseries" | "sparkline" | "threshold";

type ChartSeries = Readonly<{ label: string; values: readonly number[]; color?: string }>;

type DashboardChartProps = Readonly<{
  title: string;
  kind: ChartKind;
  series: readonly ChartSeries[];
  categories?: readonly string[];
  loading?: boolean;
  emptyMessage?: string;
  summary?: string;
}>;

const palette = ["var(--accent)", "var(--picom-aqua)", "var(--picom-orange)", "var(--success)", "var(--text-secondary)"];

function hasData(series: readonly ChartSeries[]) {
  return series.some((item) => item.values.some((value) => Number.isFinite(value)));
}

function linePath(values: readonly number[], width: number, height: number) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);
  return values.map((value, index) => {
    const x = values.length <= 1 ? width / 2 : (index / (values.length - 1)) * width;
    const y = height - ((value - min) / span) * height;
    return \`\${index === 0 ? "M" : "L"}\${x.toFixed(1)} \${y.toFixed(1)}\`;
  }).join(" ");
}

export function DashboardChart({ title, kind, series, categories = [], loading, emptyMessage, summary }: DashboardChartProps) {
  const width = 320;
  const height = 120;
  const primary = series[0];

  return (
    <section className="rd-chart" aria-label={summary ? \`\${title}. \${summary}\` : title}>
      <header>
        <strong>{title}</strong>
        <span>{kind}{categories.length ? \` · \${categories.length} pts\` : ""}</span>
      </header>
      {loading ? <div className="rd-chart__empty">Loading chart…</div> : null}
      {!loading && !hasData(series) ? <div className="rd-chart__empty">{emptyMessage ?? "No chart series available"}</div> : null}
      {!loading && hasData(series) && primary ? (
        <svg viewBox={\`0 0 \${width} \${height}\`} role="img" aria-hidden="true">
          {(kind === "bar" || kind === "stackedBar") ? primary.values.map((value, index) => {
            const max = Math.max(...primary.values, 1);
            const barWidth = width / Math.max(primary.values.length, 1) - 4;
            const barHeight = (value / max) * height;
            return <rect key={index} x={index * (barWidth + 4)} y={height - barHeight} width={barWidth} height={barHeight} fill={palette[0]} rx="3" />;
          }) : null}
          {(kind === "line" || kind === "area" || kind === "timeseries" || kind === "sparkline" || kind === "threshold") ? (
            <>
              {kind === "area" ? <path d={\`\${linePath(primary.values, width, height)} L \${width} \${height} L 0 \${height} Z\`} fill="color-mix(in srgb, var(--accent) 18%, transparent)" /> : null}
              {series.map((item, seriesIndex) => (
                <path key={item.label} d={linePath(item.values, width, height)} fill="none" stroke={item.color ?? palette[seriesIndex % palette.length]} strokeWidth="2.2" />
              ))}
            </>
          ) : null}
          {kind === "donut" || kind === "funnel" || kind === "heatmap" ? (
            <text x={width / 2} y={height / 2} textAnchor="middle" fill="currentColor" fontSize="11">
              {kind} preview · {primary.values.length} values
            </text>
          ) : null}
        </svg>
      ) : null}
      {summary ? <p className="settings-section-description" style={{ margin: 0 }}>{summary}</p> : null}
    </section>
  );
}
`);

w("src/components/rootDashboard/components/GlobalFilterBar.tsx", `export type RootDashboardFilters = Readonly<{
  dateRange: string;
  environment: string;
  region: string;
  language: string;
  platform: string;
  role: string;
  status: string;
  search: string;
}>;

export const defaultRootDashboardFilters: RootDashboardFilters = {
  dateRange: "7d",
  environment: "production",
  region: "all",
  language: "all",
  platform: "all",
  role: "all",
  status: "all",
  search: "",
};

type GlobalFilterBarProps = Readonly<{
  value: RootDashboardFilters;
  onChange: (next: RootDashboardFilters) => void;
  onSaveView?: () => void;
}>;

export function GlobalFilterBar({ value, onChange, onSaveView }: GlobalFilterBarProps) {
  const set = <K extends keyof RootDashboardFilters>(key: K, next: RootDashboardFilters[K]) => {
    onChange({ ...value, [key]: next });
  };

  return (
    <div className="rd-filter-bar" role="search" aria-label="Dashboard filters">
      <label>Date
        <select value={value.dateRange} onChange={(event) => set("dateRange", event.target.value)}>
          <option value="24h">Last 24h</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
        </select>
      </label>
      <label>Environment
        <select value={value.environment} onChange={(event) => set("environment", event.target.value)}>
          <option value="production">Production</option>
          <option value="staging">Staging</option>
          <option value="development">Development</option>
        </select>
      </label>
      <label>Region
        <select value={value.region} onChange={(event) => set("region", event.target.value)}>
          <option value="all">All</option>
          <option value="eu">EU</option>
          <option value="us">US</option>
        </select>
      </label>
      <label>Platform
        <select value={value.platform} onChange={(event) => set("platform", event.target.value)}>
          <option value="all">All</option>
          <option value="desktop">Desktop</option>
          <option value="web">Web</option>
        </select>
      </label>
      <label>Status
        <select value={value.status} onChange={(event) => set("status", event.target.value)}>
          <option value="all">All</option>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
        </select>
      </label>
      <label>Search
        <input value={value.search} onChange={(event) => set("search", event.target.value)} placeholder="Filter…" />
      </label>
      <button type="button" onClick={() => onChange(defaultRootDashboardFilters)}>Reset</button>
      {onSaveView ? <button type="button" onClick={onSaveView}>Save view</button> : null}
    </div>
  );
}
`);

w("src/components/rootDashboard/components/DataTable.tsx", `import type { ReactNode } from "react";
import { DashboardState } from "./DashboardState";

export type DataTableColumn<T> = Readonly<{
  id: string;
  header: string;
  sortable?: boolean;
  render: (row: T) => ReactNode;
}>;

type DataTableProps<T extends { id: string }> = Readonly<{
  columns: readonly DataTableColumn<T>[];
  rows: readonly T[];
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  noPermission?: boolean;
  sortId?: string | null;
  sortDir?: "asc" | "desc";
  onSort?: (columnId: string) => void;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  selectedIds?: readonly string[];
  onSelect?: (ids: string[]) => void;
  density?: "compact" | "comfortable";
  bulkActions?: ReactNode;
}>;

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  loading,
  error,
  emptyMessage,
  noPermission,
  sortId,
  sortDir,
  onSort,
  page = 1,
  pageSize = 25,
  total,
  onPageChange,
  selectedIds = [],
  onSelect,
  density = "comfortable",
  bulkActions,
}: DataTableProps<T>) {
  if (noPermission) return <DashboardState tone="noPermission" />;
  if (loading) return <DashboardState tone="loading" />;
  if (error) return <DashboardState tone="error" detail={error} />;
  if (!rows.length) return <DashboardState tone="empty" detail={emptyMessage} />;

  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(row.id));

  return (
    <div className="rd-table-wrap">
      {bulkActions && selectedIds.length ? <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>{bulkActions}</div> : null}
      <table className={\`rd-table\${density === "compact" ? " is-compact" : ""}\`}>
        <thead>
          <tr>
            {onSelect ? (
              <th scope="col">
                <input
                  type="checkbox"
                  checked={allSelected}
                  aria-label="Select all rows"
                  onChange={(event) => onSelect(event.target.checked ? rows.map((row) => row.id) : [])}
                />
              </th>
            ) : null}
            {columns.map((column) => (
              <th key={column.id} scope="col">
                {column.sortable && onSort ? (
                  <button type="button" onClick={() => onSort(column.id)} style={{ border: 0, background: "transparent", color: "inherit", cursor: "pointer", font: "inherit" }}>
                    {column.header}{sortId === column.id ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                  </button>
                ) : column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const selected = selectedIds.includes(row.id);
            return (
              <tr key={row.id} className={selected ? "is-selected" : undefined}>
                {onSelect ? (
                  <td>
                    <input
                      type="checkbox"
                      checked={selected}
                      aria-label={\`Select row \${row.id}\`}
                      onChange={(event) => {
                        onSelect(event.target.checked ? [...selectedIds, row.id] : selectedIds.filter((id) => id !== row.id));
                      }}
                    />
                  </td>
                ) : null}
                {columns.map((column) => <td key={column.id}>{column.render(row)}</td>)}
              </tr>
            );
          })}
        </tbody>
      </table>
      {onPageChange && typeof total === "number" ? (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: 10 }}>
          <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Previous</button>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Page {page} · {pageSize}/page · {total} total</span>
          <button type="button" disabled={page * pageSize >= total} onClick={() => onPageChange(page + 1)}>Next</button>
        </div>
      ) : null}
    </div>
  );
}
`);

console.log("components ok");
