import type { Member } from "../types/community";
import { UserAvatar } from "./UserAvatar";

type MemberAvatarProps = {
  member?: Member;
  userId?: string | null;
  label?: string;
  size?: number;
  className?: string;
  avatarUrl?: string | null;
  avatarSeed?: string;
  imageAlt?: string;
};

export function MemberAvatar({
  member,
  userId,
  label,
  size = 36,
  className = "",
  avatarUrl,
  imageAlt,
}: MemberAvatarProps) {
  const displayName = label ?? member?.displayName ?? member?.username ?? "Picom member";
  const resolvedFallback = [avatarUrl, member?.avatarUrl].find((value) => typeof value === "string" && value.trim().length > 0) ?? null;
  return (
    <UserAvatar
      userId={userId ?? member?.userId}
      displayName={displayName}
      fallbackUrl={resolvedFallback}
      size={size}
      className={"member-avatar " + className}
      alt={imageAlt ?? displayName + " avatar"}
    />
  );
}
