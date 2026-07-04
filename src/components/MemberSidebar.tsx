import { useMemo, useState } from "react";
import type { MouseEvent } from "react";
import type { Community, Member } from "../types/community";
import { AppIcon } from "./AppIcon";

const avatarPalette = ["#007571", "#10C2BB", "#C24D0F", "#FF772E", "#752C05"];
const hash = (value: string) => Array.from(value).reduce((sum, char) => sum + char.charCodeAt(0), 0);

function MemberAvatar({ member, size = 34 }: { member: Member; size?: number }) {
  const color = avatarPalette[hash(member.displayName) % avatarPalette.length];
  const initials = member.displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <span
      className="generated-avatar"
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 52%, black))` }}
    >
      {initials}
    </span>
  );
}

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
        <AppIcon name="search" size="sm" />
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