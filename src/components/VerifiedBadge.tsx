import { useEffect, useId, useRef, useState } from "react";
import type { VerificationSummary } from "../types/verification";
import { getVerificationLabel, getVerificationType } from "../utils/verificationHelpers";
import { VerificationBadgeTooltip } from "./VerificationBadgeTooltip";

export type VerifiedBadgeSize = "xs" | "sm" | "md" | "lg";
type TooltipPosition = { left: number; top: number; placement: "above" | "below" };

export function VerifiedBadge({
  verification,
  size = "sm",
  className = "",
}: {
  verification?: VerificationSummary | null;
  size?: VerifiedBadgeSize;
  className?: string;
}) {
  const tooltipId = useId();
  const badgeRef = useRef<HTMLSpanElement>(null);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);
  const type = getVerificationType(verification);
  const showTooltip = () => {
    const badge = badgeRef.current;
    if (!badge || typeof window === "undefined") return;
    const rect = badge.getBoundingClientRect();
    const safeHalfWidth = Math.min(96, Math.max(24, window.innerWidth / 2 - 8));
    const center = rect.left + rect.width / 2;
    const left = Math.min(window.innerWidth - safeHalfWidth, Math.max(safeHalfWidth, center));
    const placement = rect.top >= 46 ? "above" : "below";
    setTooltipPosition({ left, top: placement === "above" ? rect.top - 8 : rect.bottom + 8, placement });
  };

  useEffect(() => {
    if (!tooltipPosition) return;
    const close = () => setTooltipPosition(null);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => { window.removeEventListener("resize", close); window.removeEventListener("scroll", close, true); };
  }, [tooltipPosition]);

  if (!type) return null;
  const label = getVerificationLabel(type);
  return (
    <span
      ref={badgeRef}
      className={`verified-badge verified-badge-${size} ${type} ${className}`.trim()}
      role="img"
      aria-label={label}
      aria-describedby={tooltipPosition ? tooltipId : undefined}
      tabIndex={0}
      onMouseEnter={showTooltip}
      onMouseLeave={() => setTooltipPosition(null)}
      onFocus={showTooltip}
      onBlur={() => setTooltipPosition(null)}
      onKeyDown={(event) => event.key === "Escape" && setTooltipPosition(null)}
    >
      <svg className="verified-badge-glyph" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
        <path d="M2.4 6.2 4.9 8.5 9.7 3.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {tooltipPosition ? <VerificationBadgeTooltip id={tooltipId} label={label} position={tooltipPosition} /> : null}
    </span>
  );
}
