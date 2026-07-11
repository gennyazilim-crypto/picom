import { createPortal } from "react-dom";

type TooltipPosition = { left: number; top: number; placement: "above" | "below" };

export function VerificationBadgeTooltip({ id, label, position }: { id: string; label: string; position: TooltipPosition }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <span id={id} className={`verified-badge-tooltip placement-${position.placement}`} role="tooltip" style={{ left: position.left, top: position.top }}>{label}</span>,
    document.body,
  );
}
