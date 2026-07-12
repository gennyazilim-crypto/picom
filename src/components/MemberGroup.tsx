import { memo, useMemo, useState, type CSSProperties } from "react";
import type { MouseEvent } from "react";
import type { Member, Role, UserStatus } from "../types/community";
import { AppIcon } from "./AppIcon";
import { VerifiedAvatarFrame } from "./VerifiedAvatarFrame";
import { VerifiedBadge } from "./VerifiedBadge";
import { getUserVerificationSummary } from "../utils/verificationHelpers";

type MemberGroupProps = {
  name: string;
  members: Member[];
  roles: Role[];
  defaultCollapsed?: boolean;
  onOpenProfile: (event: MouseEvent, member: Member) => void;
  onMemberContextMenu: (event: MouseEvent, member: Member) => void;
};

const presenceLabels: Record<UserStatus, string> = {
  online: "Online",
  idle: "Idle",
  dnd: "Do not disturb",
  offline: "Offline",
};

function roleBadgeStyle(role: Role): CSSProperties {
  return {
    color: role.color,
    borderColor: `color-mix(in srgb, ${role.color} 42%, var(--border))`,
    background: `color-mix(in srgb, ${role.color} 12%, var(--surface))`,
  };
}

type MemberRowProps = {
  member: Member;
  role?: Role;
  onOpenProfile: (event: MouseEvent, member: Member) => void;
  onMemberContextMenu: (event: MouseEvent, member: Member) => void;
};

const MemberRow = memo(function MemberRow({ member, role, onOpenProfile, onMemberContextMenu }: MemberRowProps) {
  const presenceLabel = member.statusText || presenceLabels[member.status];
  const verification = getUserVerificationSummary(member.userId, [], member.verification);

  return (
    <button
      className="member-row"
      data-presence={member.status}
      data-online={member.status !== "offline"}
      onClick={(event) => onOpenProfile(event, member)}
      onContextMenu={(event) => onMemberContextMenu(event, member)}
    >
      <span className="member-avatar-wrap">
        <VerifiedAvatarFrame user={member} size="compact" verification={verification} />
        <i
          className={`status-dot ${member.status}`}
          aria-label={`${member.displayName} status: ${presenceLabel}`}
          title={presenceLabel}
        />
      </span>

      <span className="member-copy">
        <strong>
          <span>{member.displayName}</span>
          <VerifiedBadge verification={verification} size="xs" />
          {member.isBot ? <span className="member-bot-badge">Bot</span> : null}
        </strong>
        <small>{presenceLabel}</small>
      </span>

      {role && role.name !== "Member" ? (
        <span className="member-role-badge" style={roleBadgeStyle(role)}>
          {role.name}
        </span>
      ) : null}
    </button>
  );
});

export function MemberGroup({
  name,
  members,
  roles,
  defaultCollapsed = false,
  onOpenProfile,
  onMemberContextMenu,
}: MemberGroupProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const roleById = useMemo(() => new Map(roles.map((role) => [role.id, role])), [roles]);

  if (!members.length) return null;

  return (
    <section className={`member-group${collapsed ? " is-collapsed" : ""}`}>
      <header className="member-group-header">
        <button
          type="button"
          className="member-group-toggle"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((value) => !value)}
        >
          <span className="member-group-title">{name}</span>
          <span className="member-group-count">{members.length}</span>
          <AppIcon name="chevronRight" size="xs" />
        </button>
      </header>
      {!collapsed ? (
        <div className="member-group-list">
          {members.map((member) => {
            const role = roleById.get(member.roleId);
            return (
              <MemberRow
                key={member.id}
                member={member}
                role={role}
                onOpenProfile={onOpenProfile}
                onMemberContextMenu={onMemberContextMenu}
              />
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
