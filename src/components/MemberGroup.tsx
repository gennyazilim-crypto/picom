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

export function MemberGroup({ name, members, roles, onOpenProfile, onMemberContextMenu }: MemberGroupProps) {
  if (!members.length) return null;

  return (
    <section className="member-group">
      <header>{name} <span>{members.length}</span></header>
      {members.map((member) => {
        const role = roles.find((candidate) => candidate.id === member.roleId);
        const presenceLabel = member.statusText || presenceLabels[member.status];

        return (
          <button
            key={member.id}
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
              <strong>{member.displayName}</strong>
              <small>{presenceLabel}</small>
            </span>
            {role && role.name !== "Member" ? <em style={{ color: role.color }}>{role.name}</em> : null}
          </button>
        );
      })}
    </section>
  );
}
