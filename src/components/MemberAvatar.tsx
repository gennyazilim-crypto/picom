import { useMemo } from "react";
import type { Member } from "../types/community";
import { avatarService } from "../services/avatarService";
import { getIdentityGradient, getInitials } from "../utils/generatedIdentity";

type MemberAvatarProps = {
  member?: Member;
  label?: string;
  size?: number;
  className?: string;
  avatarUrl?: string;
  avatarSeed?: string;
  imageAlt?: string;
};

export function MemberAvatar({
  member,
  label,
  size = 36,
  className = "",
  avatarUrl: avatarUrlOverride,
  avatarSeed,
  imageAlt = "",
}: MemberAvatarProps) {
  const text = label ?? member?.displayName ?? "P";
  const initials = getInitials(text, "P");
  const background = getIdentityGradient(avatarSeed ?? member?.avatarSeed ?? text);
  const avatarUrl = useMemo(
    () => avatarUrlOverride ?? avatarService.getAvatarForMember(member),
    [avatarUrlOverride, member?.userId, member?.avatarUrl],
  );

  return (
    <span
      className={`generated-avatar ${avatarUrl ? "has-avatar-image" : ""} ${className}`.trim()}
      style={{ width: size, height: size, background }}
    >
      {avatarUrl ? <img src={avatarUrl} alt={imageAlt} loading="lazy" /> : initials}
    </span>
  );
}
