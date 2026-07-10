import { memo, useMemo } from "react";
import type { MouseEvent } from "react";
import type { Member, Role, UserStatus } from "../types/community";
import { MemberAvatar } from "./MemberAvatar";

type MemberGroupProps = {
  name: string;
  members: Member[];
  roles: Role[];
  onOpenProfile: (event: MouseEvent, member: Member) => void;
  onMemberContextMenu: (event: MouseEvent, member: Member) => void;
};

const presenceLabels: Record<UserStatus, string> = {
  online: "Online",
  idle: "Idle",
  dnd: "Do not disturb",
  offline: "Offline",
};

type MemberRowProps = {
  member: Member;
  role?: Role;
  onOpenProfile: (event: MouseEvent, member: Member) => void;
  onMemberContextMenu: (event: MouseEvent, member: Member) => void;
};

const MemberRow = memo(function MemberRow({ member, role, onOpenProfile, onMemberContextMenu }: MemberRowProps) {
  const presenceLabel = member.statusText || presenceLabels[member.status];

  return (
    <button
      className="member-row"
      data-presence={member.status}
      data-online={member.status !== "offline"}
      onClick={(event) => onOpenProfile(event, member)}
      onContextMenu={(event) => onMemberContextMenu(event, member)}
    >
      <span className="member-avatar-wrap">
        <MemberAvatar member={member} size={34} />
        <i
          className={`status-dot ${member.status}`}
          aria-label={`${member.displayName} status: ${presenceLabel}`}
          title={presenceLabel}
        />
      </span>
      <span className="member-copy">
        <strong>{member.displayName}{member.isBot ? <span className="bot-badge">BOT</span> : null}</strong>
        <small>{presenceLabel}</small>
      </span>
      {role && role.name !== "Member" ? <em style={{ color: role.color }}>{role.name}</em> : null}
    </button>
  );
});

export function MemberGroup({ name, members, roles, onOpenProfile, onMemberContextMenu }: MemberGroupProps) {
  const roleById = useMemo(() => new Map(roles.map((role) => [role.id, role])), [roles]);

  if (!members.length) return null;

  return (
    <section className="member-group">
      <header>{name} <span>{members.length}</span></header>
      {members.map((member) => {
        const role = roleById.get(member.roleId);

        return <MemberRow key={member.id} member={member} role={role} onOpenProfile={onOpenProfile} onMemberContextMenu={onMemberContextMenu} />;
      })}
    </section>
  );
}
