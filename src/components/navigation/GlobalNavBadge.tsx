export function GlobalNavBadge({ value }: { value: number | string | null }) {
  if (value === null || value === 0 || value === "") return null;
  const label = typeof value === "number" && value > 99 ? "99+" : String(value);
  return <span className="global-nav-badge" aria-label={`${label} notifications`}>{label}</span>;
}
