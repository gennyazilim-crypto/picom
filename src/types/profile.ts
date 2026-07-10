import type { ChannelId, CommunityId, MessageId, UserId } from "./community";

import type { VerificationBadge } from "./verification";

export type ProfileStatus = "online" | "idle" | "busy" | "offline";

export type ProfileMediaItem = {
  id: string;
  type: "image" | "video_placeholder";
  url: string;
  thumbnailUrl?: string;
  title?: string;
  createdAt: string;
};

export type ProfileActivityType = "mention" | "reply" | "reaction" | "media_share" | "voice_join" | "message_post";

export type ProfileActivityItem = {
  id: string;
  type: ProfileActivityType;
  communityId?: CommunityId;
  channelId?: ChannelId;
  messageId?: MessageId;
  title: string;
  preview: string;
  createdAt: string;
};

export type ProfileStats = {
  communities: number;
  posts: number;
  mentions: number;
  reactions: number;
  followers: number;
  following: number;
  roles: number;
};

export type UserProfile = {
  id: UserId;
  displayName: string;
  username: string;
  avatarUrl?: string;
  coverUrl?: string;
  status: ProfileStatus;
  statusText?: string;
  location?: string;
  timezone?: string;
  joinedAt: string;
  bio: string;
  roles: string[];
  tags: string[];
  mainCommunityId?: CommunityId;
  topRole?: string;
  preferredLanguage?: string;
  activityScore?: number;
  isCurrentUser?: boolean;
  isFollowing?: boolean;
  friendshipStatus?: "none" | "incoming" | "outgoing" | "friends";
  verificationBadges?: VerificationBadge[];
  privacyRestricted?: boolean;
  stats: ProfileStats;
  media: ProfileMediaItem[];
  activities: ProfileActivityItem[];
};

export type ProfileLookupOptions = {
  currentUserId: UserId;
  followedUserIds: UserId[];
};
