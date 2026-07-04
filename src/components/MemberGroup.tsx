import type { MouseEvent } from "react";
import type { Member, Role } from "../types/community";
import { MemberAvatar } from "./MemberAvatar";

type MemberGroupProps = {
  name: string;
  members: Member[];
  roles: Role[];
  onOpenProfile: (event: MouseEvent, member: Member) => void;
  onMemberContextMenu: (event: MouseEvent, member: Member) => void;
};

export function MemberGroup({ name, members, roles, onOpenProfile, onMemberContextMenu }: MemberGroupProps) {
  if (!members.length) return null;

  return (
    <section className="member-group">
      <header>{name} <span>{members.length}</span></header>
      {members.map((member) => {
        const role = roles.find((candidate) => candidate.id === member.roleId);
        return (
          <button key={member.id} className="member-row" onClick={(event) => onOpenProfile(event, member)} onContextMenu={(event) => onMemberContextMenu(event, member)}>
            <span className="member-avatar-wrap">
              <MemberAvatar member={member} size={34} />
              <i className={`status-dot ${member.status}`} />
            </span>
            <span className="member-copy">
              <strong>{member.displayName}</strong>
              <small>{member.statusText}</small>
            </span>
            {role && role.name !== "Member" ? <em style={{ color: role.color }}>{role.name}</em> : null}
          </button>
        );
      })}
    </section>
  );
}
