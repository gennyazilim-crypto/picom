import { useMemo } from "react";
import type { Member } from "../types/community";
import { avatarService } from "../services/avatarService";
import { getIdentityGradient, getInitials } from "../utils/generatedIdentity";

type MemberAvatarProps = {
  member?: Member;
  label?: string;
  size?: number;
  className?: string;
};

export function MemberAvatar({ member, label, size = 36, className = "" }: MemberAvatarProps) {
  const text = label ?? member?.displayName ?? "P";
  const initials = getInitials(text, "P");
  const background = getIdentityGradient(member?.avatarSeed ?? text);
  const avatarUrl = useMemo(() => avatarService.getAvatarForMember(member), [member?.userId, member?.avatarUrl]);

  return (
    <span
      className={`generated-avatar ${avatarUrl ? "has-avatar-image" : ""} ${className}`.trim()}
      style={{ width: size, height: size, background }}
    >
      {avatarUrl ? <img src={avatarUrl} alt="" loading="lazy" /> : initials}
    </span>
  );
}