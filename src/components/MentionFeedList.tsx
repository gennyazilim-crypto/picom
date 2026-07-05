import type { MouseEvent } from "react";
import type { Attachment, Channel, Community, Member } from "../types/community";
import type { MentionItem } from "../types/mentions";
import { MentionFeedCard } from "./MentionFeedCard";

type MentionFeedListProps = {
  items: MentionItem[];
  communities: Community[];
  onOpenImage: (attachment: Attachment) => void;
  onOpenInChannel: (item: MentionItem) => void;
  onToggleReaction: (id: string) => void;
  onToggleSaved: (id: string) => void;
  onMarkRead: (id: string) => void;
  onOpenProfile: (event: MouseEvent, member: Member) => void;
  onOpenMore: (event: MouseEvent, item: MentionItem) => void;
};

function getCommunity(communities: Community[], item: MentionItem) {
  return communities.find((community) => community.id === item.communityId);
}

function getChannel(community: Community | undefined, item: MentionItem): Channel | undefined {
  return community?.categories.flatMap((category) => category.channels).find((channel) => channel.id === item.channelId);
}

function getMember(communities: Community[], userId: string): Member | undefined {
  return communities.flatMap((community) => community.members).find((member) => member.userId === userId);
}

function getMembers(communities: Community[], userIds: string[] = []): Member[] {
  return userIds.map((userId) => getMember(communities, userId)).filter((member): member is Member => Boolean(member));
}

export function MentionFeedList({
  items,
  communities,
  onOpenImage,
  onOpenInChannel,
  onToggleReaction,
  onToggleSaved,
  onMarkRead,
  onOpenProfile,
  onOpenMore,
}: MentionFeedListProps) {
  if (!items.length) {
    return (
      <div className="mention-empty-state">
        <strong>No mentions match this view.</strong>
        <span>Try another tab or clear the active quick filter.</span>
      </div>
    );
  }

  return (
    <div className="mention-feed-list">
      {items.map((item) => {
        const community = getCommunity(communities, item);
        const channel = getChannel(community, item);
        const author = getMember(communities, item.authorId);
        const mentionedMembers = item.mentionedUserIds.map((userId) => getMember(communities, userId)).filter(Boolean) as Member[];
        const commenters = getMembers(communities, item.commenterIds);
        const commentPreviewMembers = Object.fromEntries(
          (item.commentPreview ?? []).map((comment) => [comment.authorId, getMember(communities, comment.authorId)])
        );

        return (
          <MentionFeedCard
            key={item.id}
            item={item}
            author={author}
            community={community}
            channel={channel}
            mentionedMembers={mentionedMembers}
            commenters={commenters}
            commentPreviewMembers={commentPreviewMembers}
            onOpenImage={onOpenImage}
            onOpenInChannel={onOpenInChannel}
            onToggleReaction={onToggleReaction}
            onToggleSaved={onToggleSaved}
            onMarkRead={onMarkRead}
            onOpenProfile={onOpenProfile}
            onOpenMore={onOpenMore}
          />
        );
      })}
    </div>
  );
}
