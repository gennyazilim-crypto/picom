import type { Member } from "../types/community";
import type { VerificationSummary } from "../types/verification";
import { VerifiedAvatarFrame } from "./VerifiedAvatarFrame";

export function VerifiedProfileAvatar({
  member,
  displayName,
  verification,
  isCurrentUser,
  onEditAvatar,
}: {
  member: Member;
  displayName: string;
  verification?: VerificationSummary | null;
  isCurrentUser: boolean;
  onEditAvatar?: () => void;
}) {
  return (
    <VerifiedAvatarFrame
      user={member}
      label={displayName}
      size="profile"
      verification={verification}
      isCurrentUser={isCurrentUser}
      showEditButton={isCurrentUser}
      onEditAvatar={onEditAvatar}
      className="verified-profile-avatar"
    />
  );
}
