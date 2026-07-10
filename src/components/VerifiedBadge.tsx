import { useId, useState } from "react";
import type { VerificationSummary } from "../types/verification";
import { getVerificationLabel, getVerificationType } from "../utils/verificationHelpers";
import { VerificationBadgeTooltip } from "./VerificationBadgeTooltip";

export type VerifiedBadgeSize = "xs" | "sm" | "md" | "lg";

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
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const type = getVerificationType(verification);
  if (!type) return null;
  const label = getVerificationLabel(type);
  return (
    <span
      className={`verified-badge verified-badge-${size} ${type} ${tooltipVisible ? "is-tooltip-visible" : ""} ${className}`.trim()}
      role="img"
      aria-label={label}
      aria-describedby={tooltipVisible ? tooltipId : undefined}
      tabIndex={0}
      onMouseEnter={() => setTooltipVisible(true)}
      onMouseLeave={() => setTooltipVisible(false)}
      onFocus={() => setTooltipVisible(true)}
      onBlur={() => setTooltipVisible(false)}
      onKeyDown={(event) => event.key === "Escape" && setTooltipVisible(false)}
    >
      <svg className="verified-badge-glyph" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
        <path d="M2.4 6.2 4.9 8.5 9.7 3.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <VerificationBadgeTooltip id={tooltipId} label={label} />
    </span>
  );
}
