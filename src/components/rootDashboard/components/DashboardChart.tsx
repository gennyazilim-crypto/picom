type ChartKind =
  | "line"
  | "area"
  | "bar"
  | "stackedBar"
  | "donut"
  | "funnel"
  | "heatmap"
  | "timeseries"
  | "sparkline"
  | "threshold";

export type DashboardChartKind = ChartKind;

export type DashboardChartSeries = Readonly<{ label: string; values: readonly number[]; color?: string }>;

export type DashboardChartProps = Readonly<{
  title: string;
  kind: ChartKind;
  series: readonly DashboardChartSeries[];
  categories?: readonly string[];
  loading?: boolean;
  emptyMessage?: string;
  summary?: string;
}>;

const palette = ["var(--accent)", "var(--picom-aqua)", "var(--picom-orange)", "var(--success)", "var(--text-secondary)"];

function hasData(series: readonly DashboardChartSeries[]) {
  return series.some((item) => item.values.some((value) => Number.isFinite(value)));
}

function linePath(values: readonly number[], width: number, height: number) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);
  return values
    .map((value, index) => {
      const x = values.length <= 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = height - ((value - min) / span) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

export function DashboardChart({ title, kind, series, categories = [], loading, emptyMessage, summary }: DashboardChartProps) {
  const width = 320;
  const height = 120;
  const primary = series[0];

  return (
    <section className="rd-chart" aria-label={summary ? `${title}. ${summary}` : title}>
      <header>
        <strong>{title}</strong>
        <span>
          {kind}
          {categories.length ? ` · ${categories.length} pts` : ""}
        </span>
      </header>
      {loading ? <div className="rd-chart__empty">Loading chart…</div> : null}
      {!loading && !hasData(series) ? <div className="rd-chart__empty">{emptyMessage ?? "No chart series available"}</div> : null}
      {!loading && hasData(series) && primary ? (
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-hidden="true">
          {kind === "bar" || kind === "stackedBar"
            ? primary.values.map((value, index) => {
                const max = Math.max(...primary.values, 1);
                const barWidth = width / Math.max(primary.values.length, 1) - 4;
                const barHeight = (value / max) * height;
                return (
                  <rect
                    key={index}
                    x={index * (barWidth + 4)}
                    y={height - barHeight}
                    width={barWidth}
                    height={barHeight}
                    fill={palette[0]}
                    rx="3"
                  />
                );
              })
            : null}
          {kind === "line" || kind === "area" || kind === "timeseries" || kind === "sparkline" || kind === "threshold" ? (
            <>
              {kind === "area" ? (
                <path
                  d={`${linePath(primary.values, width, height)} L ${width} ${height} L 0 ${height} Z`}
                  fill="color-mix(in srgb, var(--accent) 18%, transparent)"
                />
              ) : null}
              {series.map((item, seriesIndex) => (
                <path
                  key={item.label}
                  d={linePath(item.values, width, height)}
                  fill="none"
                  stroke={item.color ?? palette[seriesIndex % palette.length]}
                  strokeWidth="2.2"
                />
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
      {summary ? <p className="rd-chart__summary">{summary}</p> : null}
    </section>
  );
}
