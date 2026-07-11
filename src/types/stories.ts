export type StoryStatus = "unseen" | "seen";

export type StoryType = "status" | "mention_highlight" | "media" | "voice" | "event" | "community_update" | "radio" | "podcast";
export type StorySourceType = "profile_status" | "text_message" | "radio_chat" | "radio_session" | "podcast_episode" | "podcast_comment" | "voice" | "event";

export type FollowedUserStory = Readonly<{
  id: string;
  authorId: string;
  communityId?: string;
  channelId?: string;
  messageId?: string;
  sourceType?: StorySourceType;
  sourceId?: string;
  parentSourceId?: string;
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
