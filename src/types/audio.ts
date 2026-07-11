export type AudioContentType = "radio_live" | "radio_scheduled" | "radio_ended" | "podcast_episode";
export type RadioSessionStatus = "draft" | "scheduled" | "live" | "ended" | "cancelled";
export type PodcastEpisodeStatus = "draft" | "published" | "archived";

export type RadioCommunitySettings = Readonly<{
  communityId: string;
  scheduleTimezone: string;
  listenerChatEnabled: boolean;
  listenerChatChannelId?: string;
  announcementsEnabled: boolean;
  defaultHostRole: "owner" | "host";
  scheduleVisibility: "public" | "members";
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
  defaultPublisherRole: "owner" | "publisher";
  commentsEnabled: boolean;
  explicitContentDefault: boolean;
}>;

export type PodcastSeries = Readonly<{
  id: string;
  communityId: string;
  title: string;
  description: string;
  coverUrl?: string;
  coverStoragePath?: string;
  tags?: readonly string[];
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
  replyToCommentId?: string;
  createdAt: string;
  updatedAt?: string;
  isOwn?: boolean;
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

export type RadioScheduleReminder = Readonly<{
  id: string;
  radioSessionId: string;
  userId: string;
  remindMinutesBefore: number;
  lastKnownStartsAt: string;
  lastKnownStatus: RadioSessionStatus;
  lastNotificationKey?: string;
  lastNotifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}>;

export type RadioSessionHostRole = "host" | "co_host" | "producer";

export type RadioSessionHostAssignment = Readonly<{
  id: string;
  radioSessionId: string;
  userId: string;
  hostRole: RadioSessionHostRole;
  assignedBy: string;
  assignedAt: string;
}>;

export type RadioAuditEntry = Readonly<{
  id: string;
  actorUserId: string;
  actionType: string;
  targetType: string;
  reason?: string;
  createdAt: string;
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
  hostUserId?: string;
  title: string;
  description: string;
  coverUrl?: string;
  coverStoragePath?: string;
  audioUrl?: string;
  audioStoragePath?: string;
  audioMimeType?: "audio/mpeg" | "audio/mp4" | "audio/ogg" | "audio/wav" | "audio/webm";
  audioSizeBytes?: number;
  durationSeconds: number;
  publishedAt: string;
  tags: readonly string[];
  reactionSummary: readonly AudioReactionSummary[];
  commentPreview: readonly AudioCommentPreview[];
  commentCount: number;
  listenerCount: number;
  isSavedByCurrentUser: boolean;
  isExplicit?: boolean;
  status: PodcastEpisodeStatus;
}>;

export type PodcastPlaybackProgress = Readonly<{
  episodeId: string;
  userId: string;
  positionSeconds: number;
  durationSeconds: number;
  completedAt?: string;
  lastPlayedAt: string;
}>;

export type PodcastCommunityShellSnapshot = Readonly<{
  settings: PodcastCommunitySettings;
  episodes: readonly PodcastEpisode[];
  series: readonly PodcastSeries[];
  publisherUserIds: readonly string[];
}>;

export type AudioFeedItem = Readonly<{
  id: string;
  sourceId?: string;
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
  viewCount?: number;
  reactionSummary?: readonly AudioReactionSummary[];
  commentPreview?: readonly AudioCommentPreview[];
  commentCount?: number;
  commenterIds?: readonly string[];
  isMention?: boolean;
  mentionSource?: "episode_description" | "episode_comment";
  mentionHighlight?: string;
  mentionAuthorUserId?: string;
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
