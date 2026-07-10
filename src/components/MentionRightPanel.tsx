import type { MouseEvent } from "react";
import type { Community, Member } from "../types/community";
import type { MentionItem, MentionQuickFilter } from "../types/mentions";
import { VerifiedAvatarFrame } from "./VerifiedAvatarFrame";
import { getUserVerificationVariant } from "../utils/verificationHelpers";

type MentionRightPanelProps = {
  items: MentionItem[];
  communities: Community[];
  popularUserIds: string[];
  followedUserIds: string[];
  suggestedUserIds: string[];
  blockedUserIds: string[];
  activeFilter: MentionQuickFilter | null;
  onFilterChange: (filter: MentionQuickFilter) => void;
  onOpenProfile: (event: MouseEvent, member: Member) => void;
};

function getMember(communities: Community[], userId: string): Member | undefined {
  return communities.flatMap((community) => community.members).find((member) => member.userId === userId);
}

function getMembers(communities: Community[], userIds: string[]) {
  return userIds.map((userId) => getMember(communities, userId)).filter(Boolean) as Member[];
}

function PanelMemberButton({ member, onOpenProfile }: { member: Member; onOpenProfile: (event: MouseEvent, member: Member) => void }) {
  return (
    <button className="mention-panel-member" type="button" onClick={(event) => onOpenProfile(event, member)}>
      <VerifiedAvatarFrame
        user={member}
        size="compact"
        verifiedType={getUserVerificationVariant(member.userId)}
      />
      <span>
        <strong>{member.displayName}</strong>
        <small>@{member.username}</small>
      </span>
    </button>
  );
}

export function MentionRightPanel({
  items,
  communities,
  popularUserIds,
  followedUserIds,
  suggestedUserIds,
  blockedUserIds,
  activeFilter,
  onFilterChange,
  onOpenProfile,
}: MentionRightPanelProps) {
  const feedCount = items.filter((item) => item.source === "popular_feed").length;
  const followingCount = items.filter((item) => item.source === "following").length;
  const unreadCount = items.filter((item) => item.isUnread).length;
  const savedCount = items.filter((item) => item.isSaved).length;
  const blocked = new Set(blockedUserIds);
  const popularPeople = getMembers(communities, popularUserIds.filter((userId) => !blocked.has(userId))).slice(0, 8);
  const followedPeople = getMembers(communities, followedUserIds.filter((userId) => !blocked.has(userId))).slice(0, 6);
  const suggestedPeople = getMembers(communities, suggestedUserIds.filter((userId) => !blocked.has(userId))).slice(0, 4);
  const filters: Array<{ id: MentionQuickFilter; label: string }> = [
    { id: "today", label: "Today" },
    { id: "week", label: "This week" },
    { id: "unread", label: "Unread" },
    { id: "saved", label: "Saved" },
  ];

  return (
    <aside className="mention-right-panel" aria-label="Mention feed details">
      <section className="mention-panel-card">
        <p className="eyebrow">Mention Overview</p>
        <div className="mention-overview-grid">
          <span><strong>{feedCount}</strong>Feed</span>
          <span><strong>{followingCount}</strong>Following</span>
          <span><strong>{unreadCount}</strong>Unread</span>
          <span><strong>{savedCount}</strong>Saved</span>
        </div>
      </section>

      <section className="mention-panel-card">
        <p className="eyebrow">Popular People</p>
        <div className="mention-panel-list">
          {popularPeople.map((member) => <PanelMemberButton key={`popular-${member.userId}`} member={member} onOpenProfile={onOpenProfile} />)}
        </div>
      </section>

      {suggestedPeople.length ? <section className="mention-panel-card">
        <p className="eyebrow">Suggested follows</p>
        <div className="mention-panel-list">
          {suggestedPeople.map((member) => <PanelMemberButton key={`suggested-${member.userId}`} member={member} onOpenProfile={onOpenProfile} />)}
        </div>
      </section> : null}

      <section className="mention-panel-card">
        <p className="eyebrow">Following</p>
        <div className="mention-panel-list">
          {followedPeople.map((member) => <PanelMemberButton key={`following-${member.userId}`} member={member} onOpenProfile={onOpenProfile} />)}
        </div>
      </section>

      <section className="mention-panel-card">
        <p className="eyebrow">Quick Filters</p>
        <div className="mention-filter-list">
          {filters.map((filter) => (
            <button
              key={filter.id}
              className={activeFilter === filter.id ? "active" : ""}
              type="button"
              onClick={() => onFilterChange(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
}
