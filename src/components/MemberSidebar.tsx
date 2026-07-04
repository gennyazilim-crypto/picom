import { useMemo, useState } from "react";
import type { MouseEvent } from "react";
import type { Community, Member } from "../types/community";
import { AppIcon } from "./AppIcon";
import { mvpUiIconMap } from "./iconRegistry";
import { MemberAvatar } from "./MemberAvatar";

const memberSidebarIcons = mvpUiIconMap.memberSidebar;
type MemberSidebarProps = {
  community: Community;
  onOpenProfile: (event: MouseEvent, member: Member) => void;
  onMemberContextMenu: (event: MouseEvent, member: Member) => void;
};

export function MemberSidebar({ community, onOpenProfile, onMemberContextMenu }: MemberSidebarProps) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => community.members.filter((member) => `${member.displayName} ${member.username}`.toLowerCase().includes(query.toLowerCase())),
    [community.members, query],
  );
  const groups = [
    { name: "Admins", members: filtered.filter((member) => ["owner", "admin"].includes(member.roleId)) },
    { name: "Moderators", members: filtered.filter((member) => member.roleId === "mod") },
    { name: "Participants", members: filtered.filter((member) => !["owner", "admin", "mod"].includes(member.roleId) && member.status !== "offline") },
    { name: "Offline", members: filtered.filter((member) => member.status === "offline") },
  ];

  return (
    <aside className="member-sidebar">
      <div className="member-search">
        <AppIcon name={memberSidebarIcons.search} size="sm" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search participants" />
      </div>
      <div className="member-list">
        {groups.map((group) =>
          group.members.length ? (
            <section className="member-group" key={group.name}>
              <header>{group.name} <span>{group.members.length}</span></header>
              {group.members.map((member) => {
                const role = community.roles.find((candidate) => candidate.id === member.roleId);
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
          ) : null,
        )}
        {!filtered.length ? <div className="empty-state compact">No members found</div> : null}
      </div>
    </aside>
  );
}