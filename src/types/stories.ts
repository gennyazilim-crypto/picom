export type StoryStatus = "unseen" | "seen";

export type StoryType = "status" | "mention_highlight" | "media" | "voice" | "event" | "community_update";

export type FollowedUserStory = Readonly<{
  id: string;
  authorId: string;
  communityId?: string;
  channelId?: string;
  messageId?: string;
  type: StoryType;
  title: string;
  subtitle?: string;
  body?: string;
  imageUrl?: string;
  gradient?: string;
  timeLabel: string;
  createdAt: string;
  status: StoryStatus;
  durationSeconds?: number;
  mentionedUserIds?: string[];
}>;
