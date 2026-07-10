import type { Member } from "../types/community";
import type { VerificationBadgeVariant } from "../utils/verificationHelpers";
import { VerifiedAvatarFrame } from "./VerifiedAvatarFrame";

export function VerifiedProfileAvatar({
  member,
  displayName,
  verifiedType,
  isCurrentUser,
  onEditAvatar,
}: {
  member: Member;
  displayName: string;
  verifiedType?: VerificationBadgeVariant | null;
  isCurrentUser: boolean;
  onEditAvatar?: () => void;
}) {
  return (
    <VerifiedAvatarFrame
      user={member}
      label={displayName}
      size="profile"
      verifiedType={verifiedType}
      isCurrentUser={isCurrentUser}
      showEditButton={isCurrentUser}
      onEditAvatar={onEditAvatar}
      className="verified-profile-avatar"
    />
  );
}
