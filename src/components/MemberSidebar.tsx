import { useDeferredValue, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import type { Channel, Community, Member } from "../types/community";
import { getAssignedCommunityRoles, isOwnerRole } from "../services/permissions/communityPermissions";
import { AppIcon } from "./AppIcon";
import { mvpUiIconMap } from "./iconRegistry";
import { MemberGroup } from "./MemberGroup";
import "./MemberSidebar.css";

const memberSidebarIcons = mvpUiIconMap.memberSidebar;

type MemberSidebarBucket = "owners" | "admins" | "moderators" | "online" | "offline";

function getMemberSidebarBucket(member: Member, community: Community): MemberSidebarBucket {
  if (member.status === "offline") {
    return "offline";
  }

  const roles = getAssignedCommunityRoles(member, community);
  const primaryRole = roles[0] ?? community.roles.find((role) => role.id === member.roleId);

  if (community.ownerId === member.userId || isOwnerRole(primaryRole)) {
    return "owners";
  }

  if (primaryRole?.systemKey === "admin" || primaryRole?.name === "Admin") {
    return "admins";
  }

  if (primaryRole?.systemKey === "moderator" || primaryRole?.name === "Moderator" || member.roleId === "mod") {
    return "moderators";
  }

  if (member.roleId === "owner") {
    return "owners";
  }

  if (member.roleId === "admin") {
    return "admins";
  }

  return "online";
}

type MemberSidebarProps = {
  community: Community;
  channel?: Channel;
  onOpenProfile: (event: MouseEvent, member: Member) => void;
  onMemberContextMenu: (event: MouseEvent, member: Member) => void;
};

export function MemberSidebar({ community, channel, onOpenProfile, onMemberContextMenu }: MemberSidebarProps) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().toLowerCase();
  const roleById = useMemo(() => new Map(community.roles.map((role) => [role.id, role])), [community.roles]);

  const filtered = useMemo(
    () =>
      community.members.filter((member) => {
        if (!normalizedQuery) return true;
        const role = roleById.get(member.roleId);
        return `${member.displayName} ${member.username} ${member.statusText} ${member.status} ${role?.name ?? ""}`
          .toLowerCase()
          .includes(normalizedQuery);
      }),
    [community.members, normalizedQuery, roleById],
  );

  const groups = useMemo(
    () => [
      { name: "Owners", members: filtered.filter((member) => getMemberSidebarBucket(member, community) === "owners"), defaultCollapsed: false },
      { name: "Admins", members: filtered.filter((member) => getMemberSidebarBucket(member, community) === "admins"), defaultCollapsed: false },
      { name: "Moderators", members: filtered.filter((member) => getMemberSidebarBucket(member, community) === "moderators"), defaultCollapsed: false },
      { name: "Members", members: filtered.filter((member) => getMemberSidebarBucket(member, community) === "online"), defaultCollapsed: false },
      { name: "Offline", members: filtered.filter((member) => getMemberSidebarBucket(member, community) === "offline"), defaultCollapsed: true },
    ],
    [community, filtered],
  );

  return (
    <aside
      className="member-sidebar"
      data-sidebar-kind="members"
      aria-label={channel ? `${community.name} · #${channel.name} members` : `${community.name} members`}
    >
      <div className="member-search">
        <AppIcon name={memberSidebarIcons.search} size="sm" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search members"
          aria-label="Search members"
        />
        {query ? (
          <button type="button" className="member-search-clear" aria-label="Clear member search" onClick={() => setQuery("")}>
            <AppIcon name="close" size="xs" />
          </button>
        ) : null}
      </div>

      <div className="member-list">
        {groups.map((group) => (
          <MemberGroup
            key={group.name}
            name={group.name}
            members={group.members}
            roles={community.roles}
            defaultCollapsed={group.defaultCollapsed}
            onOpenProfile={onOpenProfile}
            onMemberContextMenu={onMemberContextMenu}
          />
        ))}

        {!filtered.length ? (
          <div className="member-sidebar-empty">
            <span className="member-sidebar-empty-icon" aria-hidden="true">
              <AppIcon name="users" size="lg" />
            </span>
            <strong>No members found</strong>
            <span>{query ? `Nothing matched "${query}".` : "This community has no visible members yet."}</span>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
