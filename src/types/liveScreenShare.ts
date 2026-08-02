export type LiveScreenShareStatus = "starting" | "live" | "reconnecting" | "ended" | "terminated";

export type LiveScreenShareCategory = "game" | "chat" | "education" | "watch_together" | "other";

export type LiveScreenShareFilter =
  | "all"
  | "member"
  | "following"
  | "friends_watching"
  | "game"
  | "chat"
  | "education"
  | "watch_together"
  | "other";

export type LiveScreenShareSort = "recommended" | "viewers" | "newest" | "longest";

/**
 * Camel-cased projection of `list_visible_live_screen_sessions` / mutation RPC rows.
 * Fields only populated by the join-backed list RPC (community/channel/broadcaster names,
 * friend viewer ids, relevance score) default to empty values when a row comes from a
 * mutation RPC that returns the bare `community_live_screen_sessions` row.
 */
export type LiveScreenShareSummary = Readonly<{
  id: string;
  livekitRoomName: string;
  communityId: string;
  channelId: string;
  broadcasterUserId: string;
  title: string;
  category: LiveScreenShareCategory;
  applicationName: string;
  status: LiveScreenShareStatus;
  startedAt: string;
  endedAt: string | null;
  viewerCount: number;
  participantCount: number;
  previewUpdatedAt: string | null;
  communityName: string;
  channelName: string;
  broadcasterDisplayName: string;
  broadcasterUsername: string;
  friendViewerIds: readonly string[];
  relevanceScore: number;
}>;

export type LiveScreenShareCursor = Readonly<{
  startedAt: string;
  id: string;
}>;

export type LiveScreenSharePage = Readonly<{
  items: readonly LiveScreenShareSummary[];
  nextCursor: LiveScreenShareCursor | null;
}>;

/** Badge value for nav/tab counters: hides zero, caps large counts at "99+". */
export type LiveBadgeCount = number | "99+" | null;
