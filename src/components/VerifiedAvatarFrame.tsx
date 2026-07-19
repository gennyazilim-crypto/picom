import type { CSSProperties } from "react";
import type { Member } from "../types/community";
import type { VerificationSummary } from "../types/verification";
import { getVerificationType } from "../utils/verificationHelpers";
import { MemberAvatar } from "./MemberAvatar";
import { ProfileEditCameraButton } from "./ProfileEditCameraButton";
import { VerifiedAvatarRing } from "./VerifiedAvatarRing";
import { VerifiedBadge, type VerifiedBadgeSize } from "./VerifiedBadge";

export type VerifiedAvatarFrameSize = "compact" | "medium" | "profile";

type VerifiedAvatarFrameProps = {
  user?: Member;
  userId?: string;
  label?: string;
  avatarUrl?: string;
  avatarSeed?: string;
  size?: VerifiedAvatarFrameSize;
  avatarSize?: number;
  verification?: VerificationSummary | null;
  isCurrentUser?: boolean;
  showEditButton?: boolean;
  onEditAvatar?: () => void;
  className?: string;
};

const avatarSizes: Record<VerifiedAvatarFrameSize, number> = {
  compact: 34,
  medium: 46,
  profile: 156,
};

const badgeSizes: Record<VerifiedAvatarFrameSize, VerifiedBadgeSize> = {
  compact: "xs",
  medium: "sm",
  profile: "lg",
};

export function VerifiedAvatarFrame({
  user,
  userId,
  label,
  avatarUrl,
  avatarSeed,
  size = "compact",
  avatarSize,
  verification,
  isCurrentUser = false,
  showEditButton = false,
  onEditAvatar,
  className = "",
}: VerifiedAvatarFrameProps) {
  const resolvedLabel = label ?? user?.displayName ?? "Picom user";
  const pixelSize = avatarSize ?? avatarSizes[size];
  const verifiedType = getVerificationType(verification);
  const verified = Boolean(verifiedType);
  const style = { "--verified-avatar-size": `${pixelSize}px` } as CSSProperties;

  // TODO: Production verification must come from the RLS-protected
  // profile_verifications/community_verifications approval records.
  return (
    <span
      className={`verified-avatar-frame verified-avatar-frame-${size} ${verified ? "is-verified" : ""} ${className}`.trim()}
      style={style}
      data-user-id={userId ?? user?.userId}
    >
      {verifiedType && size === "profile" && <VerifiedAvatarRing variant={verifiedType} profile />}
      <MemberAvatar
        member={user}
        userId={userId ?? user?.userId}
        label={resolvedLabel}
        size={pixelSize}
        avatarUrl={avatarUrl}
        avatarSeed={avatarSeed}
        imageAlt={`${resolvedLabel} avatar`}
        className="verified-avatar-image"
      />
      {verifiedType && size === "profile" && (
        <VerifiedBadge
          verification={verification}
          size={badgeSizes[size]}
          className="verified-avatar-badge"
        />
      )}
      {size === "profile" && isCurrentUser && showEditButton && (
        <ProfileEditCameraButton onClick={onEditAvatar} />
      )}
    </span>
  );
}
