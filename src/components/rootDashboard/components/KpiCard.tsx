export type KpiCardVariant = "standard" | "realtime" | "warning" | "trend" | "ratio" | "progress" | "stale";

export type KpiCardProps = Readonly<{
  label: string;
  value?: number | string | null;
  previousValue?: number | null;
  unit?: string;
  trendPercent?: number | null;
  freshnessIso?: string | null;
  definition?: string;
  loading?: boolean;
  unavailableReason?: string;
  variant?: KpiCardVariant;
  onDrillDown?: () => void;
}>;

function formatValue(value: number | string | null | undefined, unit?: string) {
  if (value === null || value === undefined || value === "") return "—";
  const base = typeof value === "number" ? new Intl.NumberFormat().format(value) : value;
  return unit ? `${base} ${unit}` : base;
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
  const aria = definition ? `${label}. ${definition}` : label;
  const className = [
    "rd-kpi",
    `is-${variant}`,
    loading ? "is-skeleton" : "",
    unavailable ? "is-unavailable" : "",
  ].filter(Boolean).join(" ");

  const content = (
    <>
      <span>{label}</span>
      <strong>{loading ? "••••" : formatValue(value, unit)}</strong>
      {unavailable ? <em>{unavailableReason ?? "Unavailable"}</em> : null}
      {!unavailable && typeof trendPercent === "number" ? (
        <em className={`rd-kpi__trend ${trendPercent >= 0 ? "up" : "down"}`}>
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
