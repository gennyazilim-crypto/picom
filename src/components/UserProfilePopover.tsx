import { useEffect } from "react";
import type { Community, Member } from "../types/community";
import { MemberAvatar } from "./MemberAvatar";

type UserProfilePopoverProps = {
  member: Member;
  community: Community;
  x: number;
  y: number;
  onClose: () => void;
};

export function UserProfilePopover({ member, community, x, y, onClose }: UserProfilePopoverProps) {
  useEffect(() => {
    const close = () => onClose();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const role = community.roles.find((candidate) => candidate.id === member.roleId);
  const left = Math.min(x, Math.max(20, window.innerWidth - 340));
  const top = Math.min(y, Math.max(20, window.innerHeight - 430));

  return (
    <section className="profile-popover" style={{ left, top }} onPointerDown={(event) => event.stopPropagation()}>
      <div className="profile-cover" />
      <div className="profile-body">
        <MemberAvatar member={member} size={72} />
        <h3>{member.displayName}</h3>
        <p>@{member.username}</p>
        <div className="profile-meta">
          <span className={`status-dot ${member.status}`} />
          <span>{member.statusText}</span>
        </div>
        {role ? <span className="role-pill" style={{ color: role.color }}>{role.name}</span> : null}
        <p className="profile-bio">{member.bio}</p>
        <div className="profile-actions">
          <button>Message</button>
          <button>View profile</button>
        </div>
      </div>
    </section>
  );
}
