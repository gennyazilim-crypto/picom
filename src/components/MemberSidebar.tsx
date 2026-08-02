import { useCallback, useDeferredValue, useMemo, useState, useSyncExternalStore } from "react";
import type { MouseEvent } from "react";
import type { Channel, Community, Member } from "../types/community";
import { getAssignedCommunityRoles, isOwnerRole } from "../services/permissions/communityPermissions";
import { profileMediaStore } from "../services/profileMedia/profileMediaStore";
import { globalPresenceStore } from "../stores/globalPresenceStore";
import { ensureCommunityMemberRoster } from "../utils/ensureCommunityMemberRoster";
import { AppIcon } from "./AppIcon";
import { mvpUiIconMap } from "./iconRegistry";
import { MemberGroup } from "./MemberGroup";
import "./MemberSidebar.css";

const memberSidebarIcons = mvpUiIconMap.memberSidebar;

type MemberSidebarBucket = "owners" | "admins" | "moderators" | "online" | "offline";

function getMemberSidebarBucket(member: Member, community: Community): MemberSidebarBucket {
  const roles = getAssignedCommunityRoles(member, community);
  const primaryRole = roles[0] ?? community.roles.find((role) => role.id === member.roleId);

  // Staff stay in their role groups even when offline so founders/mods don't vanish
  // into a collapsed Offline section (or look "missing" when the roster is thin).
  if (community.ownerId === member.userId || isOwnerRole(primaryRole) || member.roleId === "owner") {
    return "owners";
  }

  if (primaryRole?.systemKey === "admin" || primaryRole?.name === "Admin" || member.roleId === "admin") {
    return "admins";
  }

  if (primaryRole?.systemKey === "moderator" || primaryRole?.name === "Moderator" || member.roleId === "mod") {
    return "moderators";
  }

  if (member.status === "offline") {
    return "offline";
  }

  return "online";
}

type MemberSidebarProps = {
  community: Community;
  channel?: Channel;
  currentUserId: string;
  onOpenProfile: (event: MouseEvent, member: Member) => void;
  onMemberContextMenu: (event: MouseEvent, member: Member) => void;
};

export function MemberSidebar({ community, channel, currentUserId, onOpenProfile, onMemberContextMenu }: MemberSidebarProps) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().toLowerCase();
  const ownPresence = useSyncExternalStore(
    globalPresenceStore.subscribe,
    globalPresenceStore.getSnapshot,
    globalPresenceStore.getSnapshot,
  );
  const roster = useMemo(() => ensureCommunityMemberRoster(community).map((member) => {
    if (member.userId !== currentUserId || !ownPresence.visibleToOthers) return member;
    return { ...member, status: ownPresence.publicStatus, statusText: ownPresence.label };
  }), [community, currentUserId, ownPresence.label, ownPresence.publicStatus, ownPresence.visibleToOthers]);
  const memberUserIds = useMemo(() => roster.map((member) => member.userId), [roster]);
  const subscribeToMemberIdentity = useCallback((listener: () => void) => {
    const cleanups = memberUserIds.map((userId) => profileMediaStore.subscribe(userId, listener));
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [memberUserIds]);
  const getMemberIdentityRevision = useCallback(() => memberUserIds.map((userId) => {
    const record = profileMediaStore.getSnapshot(userId).record;
    return [userId, record?.updatedAt ?? "", record?.displayName ?? "", record?.username ?? ""].join(":");
  }).join("|"), [memberUserIds]);
  const memberIdentityRevision = useSyncExternalStore(
    subscribeToMemberIdentity,
    getMemberIdentityRevision,
    getMemberIdentityRevision,
  );
  const roleById = useMemo(() => new Map(community.roles.map((role) => [role.id, role])), [community.roles]);

  const filtered = useMemo(
    () =>
      roster.filter((member) => {
        if (!normalizedQuery) return true;
        const role = roleById.get(member.roleId);
        const liveIdentity = profileMediaStore.getSnapshot(member.userId).record;
        const displayName = liveIdentity?.displayName?.trim() || member.displayName;
        const username = liveIdentity?.username?.trim() || member.username;
        return `${displayName} ${username} ${member.statusText} ${member.status} ${role?.name ?? ""}`
          .toLowerCase()
          .includes(normalizedQuery);
      }),
    [memberIdentityRevision, normalizedQuery, roleById, roster],
  );

  const groups = useMemo(
    () => {
      const owners = filtered.filter((member) => getMemberSidebarBucket(member, community) === "owners");
      const admins = filtered.filter((member) => getMemberSidebarBucket(member, community) === "admins");
      const moderators = filtered.filter((member) => getMemberSidebarBucket(member, community) === "moderators");
      const online = filtered.filter((member) => getMemberSidebarBucket(member, community) === "online");
      const offline = filtered.filter((member) => getMemberSidebarBucket(member, community) === "offline");
      // Keep Offline expanded when it is the only place ordinary members appear.
      const collapseOffline = online.length > 0 || offline.length > 12;
      return [
        { name: "Owners", members: owners, defaultCollapsed: false },
        { name: "Admins", members: admins, defaultCollapsed: false },
        { name: "Moderators", members: moderators, defaultCollapsed: false },
        { name: "Members", members: online, defaultCollapsed: false },
        { name: "Offline", members: offline, defaultCollapsed: collapseOffline },
      ];
    },
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
            <span>{query ? `Nothing matched "${query}".` : "Member list is still loading or hidden for this community."}</span>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
