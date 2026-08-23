import { useTranslation } from "../../i18n";

export function GlobalNavBadge({ value, destination }: { value: number | string | null; destination: string }) {
  const { t } = useTranslation("navigation");
  if (value === null || value === 0 || value === "") return null;
  const label = typeof value === "number" && value > 99 ? "99+" : String(value);
  const accessibleLabel = typeof value === "string" ? t("badge.value", { destination, value: label }) : t("badge.unread", { destination, value: label });
  return <span className="global-nav-badge" aria-label={accessibleLabel}>{label}</span>;
}
