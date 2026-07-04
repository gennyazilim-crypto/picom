import { useMemo } from "react";
import type { Member } from "../types/community";
import { avatarService } from "../services/avatarService";

const avatarPalette = ["#007571", "#10C2BB", "#C24D0F", "#FF772E", "#752C05"];
const hash = (value: string) => Array.from(value).reduce((sum, char) => sum + char.charCodeAt(0), 0);

type MemberAvatarProps = {
  member?: Member;
  label?: string;
  size?: number;
  className?: string;
};

export function MemberAvatar({ member, label, size = 36, className = "" }: MemberAvatarProps) {
  const text = label ?? member?.displayName ?? "P";
  const color = avatarPalette[hash(member?.avatarSeed ?? text) % avatarPalette.length];
  const initials = text
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const avatarUrl = useMemo(() => avatarService.getAvatarForMember(member), [member?.userId, member?.avatarUrl]);

  return (
    <span
      className={`generated-avatar ${avatarUrl ? "has-avatar-image" : ""} ${className}`.trim()}
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 52%, black))` }}
    >
      {avatarUrl ? <img src={avatarUrl} alt="" loading="lazy" /> : initials}
    </span>
  );
}