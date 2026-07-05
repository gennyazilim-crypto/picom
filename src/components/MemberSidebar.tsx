import { useDeferredValue, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import type { Community, Member } from "../types/community";
import { AppIcon } from "./AppIcon";
import { mvpUiIconMap } from "./iconRegistry";
import { MemberGroup } from "./MemberGroup";

const memberSidebarIcons = mvpUiIconMap.memberSidebar;
type MemberSidebarProps = {
  community: Community;
  onOpenProfile: (event: MouseEvent, member: Member) => void;
  onMemberContextMenu: (event: MouseEvent, member: Member) => void;
};

export function MemberSidebar({ community, onOpenProfile, onMemberContextMenu }: MemberSidebarProps) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().toLowerCase();
  const roleById = useMemo(() => new Map(community.roles.map((role) => [role.id, role])), [community.roles]);
  const filtered = useMemo(
    () =>
      community.members.filter((member) => {
        if (!normalizedQuery) return true;
        const role = roleById.get(member.roleId);
        return `${member.displayName} ${member.username} ${member.statusText} ${member.status} ${role?.name ?? ""}`.toLowerCase().includes(normalizedQuery);
      }),
    [community.members, normalizedQuery, roleById],
  );
  const groups = useMemo(
    () => [
      { name: "Admins", members: filtered.filter((member) => ["owner", "admin"].includes(member.roleId)) },
      { name: "Moderators", members: filtered.filter((member) => member.roleId === "mod") },
      { name: "Participants", members: filtered.filter((member) => !["owner", "admin", "mod"].includes(member.roleId) && member.status !== "offline") },
      { name: "Offline", members: filtered.filter((member) => member.status === "offline") },
    ],
    [filtered],
  );

  return (
    <aside className="member-sidebar">
      <div className="member-search">
        <AppIcon name={memberSidebarIcons.search} size="sm" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search participants" aria-label="Search members" />
      </div>
      <div className="member-list">
        {groups.map((group) => (
          <MemberGroup
            key={group.name}
            name={group.name}
            members={group.members}
            roles={community.roles}
            onOpenProfile={onOpenProfile}
            onMemberContextMenu={onMemberContextMenu}
          />
        ))}
        {!filtered.length ? <div className="empty-state compact">No members found{query ? ` for ${query}` : ""}</div> : null}
      </div>
    </aside>
  );
}
