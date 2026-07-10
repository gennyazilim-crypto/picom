import { useId } from "react";
import type { VerificationBadgeVariant } from "../utils/verificationHelpers";
import { VerificationBadgeTooltip } from "./VerificationBadgeTooltip";

export type VerifiedBadgeSize = "xs" | "sm" | "md" | "lg";

const labels: Record<VerificationBadgeVariant, string> = {
  verified_user: "Verified user",
  official_community: "Official community",
  picom_staff: "Picom staff",
  verified_bot: "Verified bot",
};

export function VerifiedBadge({
  variant,
  size = "sm",
  className = "",
}: {
  variant?: VerificationBadgeVariant | null;
  size?: VerifiedBadgeSize;
  className?: string;
}) {
  const tooltipId = useId();
  if (!variant) return null;
  const label = labels[variant];
  return (
    <span
      className={`verified-badge verified-badge-${size} ${variant} ${className}`.trim()}
      role="img"
      aria-label={label}
      aria-describedby={tooltipId}
      title={label}
      tabIndex={0}
    >
      <span className="verified-badge-glyph" aria-hidden="true" />
      <VerificationBadgeTooltip id={tooltipId} label={label} />
    </span>
  );
}
