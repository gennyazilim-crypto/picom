import { useId } from "react";
import type { VerificationBadgeVariant } from "../utils/verificationHelpers";
import { VerificationBadgeTooltip } from "./VerificationBadgeTooltip";

const labels: Record<VerificationBadgeVariant, string> = {
  verified_user: "Verified user",
  official_community: "Official community",
  picom_staff: "Picom staff",
  verified_bot: "Verified bot",
};

export function VerifiedBadge({ variant, className = "" }: { variant?: VerificationBadgeVariant | null; className?: string }) {
  const tooltipId = useId();
  if (!variant) return null;
  const label = labels[variant];
  return (
    <span className={`verified-badge ${variant} ${className}`.trim()} role="img" aria-label={label} aria-describedby={tooltipId} tabIndex={0}>
      <span className="verified-badge-glyph" aria-hidden="true" />
      <VerificationBadgeTooltip id={tooltipId} label={label} />
    </span>
  );
}
