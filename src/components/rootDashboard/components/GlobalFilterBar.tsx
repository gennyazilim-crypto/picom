export type RootDashboardDateRange = "24h" | "7d" | "30d" | "90d" | string;

export type RootDashboardFilterState = Readonly<{
  dateRange: RootDashboardDateRange;
  environment: string;
  region: string;
  language: string;
  platform: string;
  role: string;
  status: string;
  search: string;
}>;

export type RootDashboardFilters = RootDashboardFilterState;

export type GlobalFilterBarOption = Readonly<{ value: string; label: string }>;

export const EMPTY_ROOT_DASHBOARD_FILTERS: RootDashboardFilterState = {
  dateRange: "7d",
  environment: "production",
  region: "all",
  language: "all",
  platform: "all",
  role: "all",
  status: "all",
  search: "",
};

export const defaultRootDashboardFilters = EMPTY_ROOT_DASHBOARD_FILTERS;

export type GlobalFilterBarProps = Readonly<{
  value: RootDashboardFilterState;
  onChange: (next: RootDashboardFilterState) => void;
  onSaveView?: () => void;
}>;

export function GlobalFilterBar({ value, onChange, onSaveView }: GlobalFilterBarProps) {
  const set = <K extends keyof RootDashboardFilterState>(key: K, next: RootDashboardFilterState[K]) => {
    onChange({ ...value, [key]: next });
  };

  return (
    <div className="rd-filter-bar" role="search" aria-label="Dashboard filters">
      <label>
        Date
        <select value={value.dateRange} onChange={(event) => set("dateRange", event.target.value)}>
          <option value="24h">Last 24h</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
        </select>
      </label>
      <label>
        Environment
        <select value={value.environment} onChange={(event) => set("environment", event.target.value)}>
          <option value="production">Production</option>
          <option value="staging">Staging</option>
          <option value="development">Development</option>
        </select>
      </label>
      <label>
        Region
        <select value={value.region} onChange={(event) => set("region", event.target.value)}>
          <option value="all">All</option>
          <option value="eu">EU</option>
          <option value="us">US</option>
        </select>
      </label>
      <label>
        Platform
        <select value={value.platform} onChange={(event) => set("platform", event.target.value)}>
          <option value="all">All</option>
          <option value="desktop">Desktop</option>
          <option value="web">Web</option>
        </select>
      </label>
      <label>
        Status
        <select value={value.status} onChange={(event) => set("status", event.target.value)}>
          <option value="all">All</option>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
        </select>
      </label>
      <label>
        Search
        <input value={value.search} onChange={(event) => set("search", event.target.value)} placeholder="Filter…" />
      </label>
      <button type="button" onClick={() => onChange(EMPTY_ROOT_DASHBOARD_FILTERS)}>
        Reset
      </button>
      {onSaveView ? (
        <button type="button" onClick={onSaveView}>
          Save view
        </button>
      ) : null}
    </div>
  );
}
