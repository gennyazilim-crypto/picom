export function GlobalNavBadge({ value, destination }: { value: number | string | null; destination: string }) {
  if (value === null || value === 0 || value === "") return null;
  const label = typeof value === "number" && value > 99 ? "99+" : String(value);
  const accessibleLabel = typeof value === "string" ? `${destination}: ${label}` : `${destination}: ${label} unread`;
  return <span className="global-nav-badge" aria-label={accessibleLabel}>{label}</span>;
}
