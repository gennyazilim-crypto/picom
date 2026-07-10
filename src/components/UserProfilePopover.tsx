import { useEffect, useRef } from "react";
import type { Community, Member } from "../types/community";
import { MemberAvatar } from "./MemberAvatar";

type UserProfilePopoverProps = { member: Member; community: Community; x: number; y: number; onClose: () => void; onViewProfile?: (member: Member) => void; onReportUser?: (member: Member) => void; isBlocked?: boolean; onToggleBlock?: (member: Member) => void };

export function UserProfilePopover({ member, community, x, y, onClose, onViewProfile, onReportUser, isBlocked = false, onToggleBlock }: UserProfilePopoverProps) {
  const popoverRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const close = () => onClose();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", onKey);
    window.requestAnimationFrame(() => popoverRef.current?.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus());
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", onKey);
      window.requestAnimationFrame(() => previousFocus?.focus());
    };
  }, [onClose]);

  const role = community.roles.find((candidate) => candidate.id === member.roleId);
  const left = Math.min(x, Math.max(20, window.innerWidth - 340));
  const top = Math.min(y, Math.max(20, window.innerHeight - 430));
  return <section ref={popoverRef} className="profile-popover" role="dialog" aria-label={`${member.displayName} profile preview`} tabIndex={-1} style={{ left, top }} onPointerDown={(event) => event.stopPropagation()}>
    <div className="profile-cover" aria-hidden="true" />
    <div className="profile-body">
      <MemberAvatar member={member} size={72} />
      <h3>{member.displayName}</h3><p>@{member.username}</p>
      <div className="profile-meta"><span className={`status-dot ${member.status}`} aria-hidden="true" /><span>{member.statusText}</span></div>
      {role ? <span className="role-pill" style={{ color: role.color }}>{role.name}</span> : null}
      <p className="profile-bio">{member.bio}</p>
      <div className="profile-actions">
        <button type="button">Message</button>
        <button type="button" onClick={() => onViewProfile?.(member)}>View profile</button>
        {onReportUser ? <button type="button" onClick={() => onReportUser(member)}>Report</button> : null}
        {onToggleBlock ? <button type="button" onClick={() => onToggleBlock(member)}>{isBlocked ? "Unblock" : "Block"}</button> : null}
      </div>
    </div>
  </section>;
}
