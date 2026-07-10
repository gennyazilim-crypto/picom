import type { VerificationBadgeVariant } from "../utils/verificationHelpers";

export function VerifiedAvatarRing({
  variant,
  profile = false,
}: {
  variant: VerificationBadgeVariant;
  profile?: boolean;
}) {
  return (
    <span
      className={`verified-avatar-ring verified-avatar-ring-${profile ? "profile" : "subtle"} ${variant}`}
      aria-hidden="true"
    />
  );
}
