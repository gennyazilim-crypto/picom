export function VerificationBadgeTooltip({ id, label }: { id: string; label: string }) {
  return <span id={id} className="verified-badge-tooltip" role="tooltip">{label}</span>;
}
