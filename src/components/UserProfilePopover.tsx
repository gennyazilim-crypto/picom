import { useEffect, useRef } from "react";
import type { Community, Member } from "../types/community";
import { clampOverlayPosition } from "../utils/desktopDisplayBounds";
import { getUserVerificationSummary } from "../utils/verificationHelpers";
import { VerifiedAvatarFrame } from "./VerifiedAvatarFrame";
import { VerifiedBadge } from "./VerifiedBadge";
import "./UserProfilePopover.css";

type UserProfilePopoverProps = {
  member: Member;
  community: Community;
  x: number;
  y: number;
  onClose: () => void;
  onOpenMessage?: (member: Member) => void;
  onViewProfile?: (member: Member) => void;
  onReportUser?: (member: Member) => void;
  isBlocked?: boolean;
  onToggleBlock?: (member: Member) => void;
};

export function UserProfilePopover({
  member,
  community,
  x,
  y,
  onClose,
  onOpenMessage,
  onViewProfile,
  onReportUser,
  isBlocked = false,
  onToggleBlock,
}: UserProfilePopoverProps) {
  const popoverRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && popoverRef.current?.contains(target)) return;
      onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    // Defer so the opening click does not immediately dismiss the popover.
    const timer = window.setTimeout(() => {
      window.addEventListener("pointerdown", onPointerDown);
    }, 0);
    window.addEventListener("keydown", onKey);
    window.requestAnimationFrame(() => popoverRef.current?.querySelector<HTMLButtonElement>(".profile-popover-action:not([disabled])")?.focus());
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
      window.requestAnimationFrame(() => previousFocus?.focus());
    };
  }, [onClose]);

  const role = community.roles.find((candidate) => candidate.id === member.roleId);
  const verification = getUserVerificationSummary(member.userId, [], member.verification);
  const { left, top } = clampOverlayPosition({
    x,
    y,
    width: 320,
    height: 380,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    margin: 20,
  });

  const openMessage = () => onOpenMessage?.(member);
  const viewProfile = () => onViewProfile?.(member);

  return (
    <section
      ref={popoverRef}
      className="profile-popover"
      role="dialog"
      aria-label={`${member.displayName} profile preview`}
      tabIndex={-1}
      style={{ left, top }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="profile-popover-cover" aria-hidden="true" />
      <div className="profile-popover-body">
        <div className="profile-popover-identity">
          <VerifiedAvatarFrame user={member} size="medium" avatarSize={72} verification={verification} />
          <div className="profile-popover-heading">
            <h3 className="profile-popover-name">
              <span>{member.displayName}</span>
              <VerifiedBadge verification={verification} size="sm" />
            </h3>
            <p className="profile-popover-handle">@{member.username}</p>
          </div>
        </div>

        <div className="profile-popover-status">
          <span className={`status-dot ${member.status}`} role="img" aria-label={`${member.displayName} is ${member.status}`} />
          <span>{member.statusText}</span>
        </div>

        {role ? (
          <span className="profile-popover-role" style={{ color: role.color }}>
            {role.name}
          </span>
        ) : null}

        {member.bio ? <p className="profile-popover-bio">{member.bio}</p> : null}

        <div className="profile-popover-actions">
          <button type="button" className="profile-popover-action primary" onClick={openMessage}>
            Message
          </button>
          <button type="button" className="profile-popover-action" onClick={viewProfile}>
            View profile
          </button>
        </div>

        {onReportUser || onToggleBlock ? (
          <div className="profile-popover-secondary">
            {onReportUser ? (
              <button type="button" onClick={() => onReportUser(member)}>
                Report
              </button>
            ) : null}
            {onToggleBlock ? (
              <button type="button" className="danger" onClick={() => onToggleBlock(member)}>
                {isBlocked ? "Unblock" : "Block"}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
