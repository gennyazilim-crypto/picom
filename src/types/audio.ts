export type AudioContentType = "radio_live" | "radio_scheduled" | "podcast_episode";
export type RadioSessionStatus = "draft" | "scheduled" | "live" | "ended" | "cancelled";
export type PodcastEpisodeStatus = "draft" | "published" | "archived";

export type RadioCommunitySettings = Readonly<{
  communityId: string;
  scheduleTimezone: string;
  listenerChatEnabled: boolean;
  listenerChatChannelId?: string;
  announcementsEnabled: boolean;
}>;

export type RadioProgram = Readonly<{
  id: string;
  communityId: string;
  title: string;
  description: string;
  hostUserId?: string;
  hostUserIds?: readonly string[];
  slug?: string;
  coverUrl?: string;
  coverStoragePath?: string;
  tags?: readonly string[];
  defaultDurationMinutes?: number;
  isActive: boolean;
  createdAt: string;
}>;

export type RadioProgramSchedule = Readonly<{
  id: string;
  programId: string;
  communityId: string;
  weekday: number;
  startsAtLocal: string;
  durationMinutes: number;
  timezone: string;
  effectiveFrom: string;
  effectiveUntil?: string;
  isActive: boolean;
}>;

export type RadioAnnouncement = Readonly<{
  id: string;
  communityId: string;
  authorUserId: string;
  body: string;
  publishedAt: string;
}>;

export type PodcastCommunitySettings = Readonly<{
  communityId: string;
  about: string;
  listenerDiscussionEnabled: boolean;
  listenerDiscussionChannelId?: string;
}>;

export type PodcastSeries = Readonly<{
  id: string;
  communityId: string;
  title: string;
  description: string;
  coverUrl?: string;
  createdBy: string;
  isActive: boolean;
  createdAt: string;
}>;

export type AudioReactionSummary = Readonly<{
  emoji: string;
  count: number;
  reactedByCurrentUser?: boolean;
}>;

export type AudioCommentPreview = Readonly<{
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
}>;

export type RadioSession = Readonly<{
  id: string;
  communityId: string;
  channelId?: string;
  programId?: string;
  hostUserId: string;
  title: string;
  description: string;
  status: RadioSessionStatus;
  startsAt: string;
  scheduledEndAt?: string;
  actualStartedAt?: string;
  endedAt?: string;
  listenerChatChannelId?: string;
  listenerCount: number;
  speakerCount: number;
  coverUrl?: string;
  coverStoragePath?: string;
  streamUrl?: string;
  tags: readonly string[];
  reactionSummary?: readonly AudioReactionSummary[];
  isFeatured: boolean;
  isSavedByCurrentUser: boolean;
}>;

export type RadioCommunityShellSnapshot = Readonly<{
  settings: RadioCommunitySettings;
  sessions: readonly RadioSession[];
  programs: readonly RadioProgram[];
  schedules: readonly RadioProgramSchedule[];
  announcements: readonly RadioAnnouncement[];
  hostUserIds: readonly string[];
}>;

export type PodcastEpisode = Readonly<{
  id: string;
  communityId: string;
  seriesId?: string;
  authorUserId: string;
  title: string;
  description: string;
  coverUrl?: string;
  audioUrl?: string;
  durationSeconds: number;
  publishedAt: string;
  tags: readonly string[];
  reactionSummary: readonly AudioReactionSummary[];
  commentPreview: readonly AudioCommentPreview[];
  commentCount: number;
  listenerCount: number;
  isSavedByCurrentUser: boolean;
  isExplicit?: false;
  status: PodcastEpisodeStatus;
}>;

export type PodcastCommunityShellSnapshot = Readonly<{
  settings: PodcastCommunitySettings;
  episodes: readonly PodcastEpisode[];
  series: readonly PodcastSeries[];
  publisherUserIds: readonly string[];
}>;

export type AudioFeedItem = Readonly<{
  id: string;
  type: AudioContentType;
  communityId: string;
  authorUserId?: string;
  hostUserId?: string;
  title: string;
  body: string;
  coverUrl?: string;
  createdAt: string;
  startsAt?: string;
  durationSeconds?: number;
  listenerCount?: number;
  reactionSummary?: readonly AudioReactionSummary[];
  commentPreview?: readonly AudioCommentPreview[];
  commentCount?: number;
  isUnread?: boolean;
  isSaved?: boolean;
}>;

export type AudioPlayableItem = Readonly<{
  id: string;
  type: AudioContentType;
  title: string;
  contextLabel: string;
  coverUrl?: string;
  audioUrl?: string;
  durationSeconds: number;
  communityId?: string;
  isLive?: boolean;
}>;
