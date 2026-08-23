import { useTranslation } from "../../../i18n";

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
  const { t } = useTranslation("admin");
  const set = <K extends keyof RootDashboardFilterState>(key: K, next: RootDashboardFilterState[K]) => {
    onChange({ ...value, [key]: next });
  };

  return (
    <div className="rd-filter-bar" role="search" aria-label={t("filter.barLabel")}>
      <label>
        {t("filter.date")}
        <select value={value.dateRange} onChange={(event) => set("dateRange", event.target.value)}>
          <option value="24h">{t("filter.date.24h")}</option>
          <option value="7d">{t("filter.date.7d")}</option>
          <option value="30d">{t("filter.date.30d")}</option>
          <option value="90d">{t("filter.date.90d")}</option>
        </select>
      </label>
      <label>
        {t("filter.environment")}
        <select value={value.environment} onChange={(event) => set("environment", event.target.value)}>
          <option value="production">{t("filter.environment.production")}</option>
          <option value="staging">{t("filter.environment.staging")}</option>
          <option value="development">{t("filter.environment.development")}</option>
        </select>
      </label>
      <label>
        {t("filter.region")}
        <select value={value.region} onChange={(event) => set("region", event.target.value)}>
          <option value="all">{t("filter.all")}</option>
          <option value="eu">EU</option>
          <option value="us">US</option>
        </select>
      </label>
      <label>
        {t("filter.platform")}
        <select value={value.platform} onChange={(event) => set("platform", event.target.value)}>
          <option value="all">{t("filter.all")}</option>
          <option value="desktop">{t("filter.platform.desktop")}</option>
          <option value="web">{t("filter.platform.web")}</option>
        </select>
      </label>
      <label>
        {t("filter.status")}
        <select value={value.status} onChange={(event) => set("status", event.target.value)}>
          <option value="all">{t("filter.all")}</option>
          <option value="open">{t("filter.status.open")}</option>
          <option value="resolved">{t("filter.status.resolved")}</option>
        </select>
      </label>
      <label>
        {t("filter.search")}
        <input value={value.search} onChange={(event) => set("search", event.target.value)} placeholder={t("filter.searchPlaceholder")} />
      </label>
      <button type="button" onClick={() => onChange(EMPTY_ROOT_DASHBOARD_FILTERS)}>
        {t("filter.reset")}
      </button>
      {onSaveView ? (
        <button type="button" onClick={onSaveView}>
          {t("filter.saveView")}
        </button>
      ) : null}
    </div>
  );
}
