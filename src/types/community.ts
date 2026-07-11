import type { VerificationSummary } from "./verification";

export type CommunityId = string;
export type ChannelId = string;
export type CategoryId = string;
export type MessageId = string;
export type MemberId = string;
export type UserId = string;
export type RoleId = string;
export type AttachmentId = string;

export type UserStatus = "online" | "idle" | "dnd" | "offline";
export type ChannelType = "text" | "voice" | "forum" | "announcement";
export type AttachmentType = "image";
export type AttachmentScanStatus = "pending" | "clean" | "suspicious" | "failed" | "skipped_development";
export type MessageDeliveryStatus = "sending" | "sent" | "delivered" | "failed" | "queued_offline";
import type { PollData } from "./polls";
export type RoleName = "Owner" | "Admin" | "Moderator" | "Radio Host" | "Podcast Publisher" | "Podcast Editor" | "Member" | "Guest";

export const COMMUNITY_KINDS = ["text", "radio", "podcast"] as const;
export type CommunityKind = (typeof COMMUNITY_KINDS)[number];

export type CommunityKindCapabilities = Readonly<{
  supportsTextChannels: boolean;
  supportsLiveRadio: boolean;
  supportsPodcastPublishing: boolean;
}>;

const COMMUNITY_KIND_CAPABILITIES: Readonly<Record<CommunityKind, CommunityKindCapabilities>> = Object.freeze({
  text: Object.freeze({ supportsTextChannels: true, supportsLiveRadio: false, supportsPodcastPublishing: false }),
  radio: Object.freeze({ supportsTextChannels: false, supportsLiveRadio: true, supportsPodcastPublishing: false }),
  podcast: Object.freeze({ supportsTextChannels: false, supportsLiveRadio: false, supportsPodcastPublishing: true }),
});

export function isCommunityKind(value: unknown): value is CommunityKind {
  return typeof value === "string" && COMMUNITY_KINDS.includes(value as CommunityKind);
}

export function getCommunityKindCapabilities(kind: CommunityKind): CommunityKindCapabilities {
  return COMMUNITY_KIND_CAPABILITIES[kind];
}

export function supportsTextChannels(subject: CommunityKind | Pick<Community, "kind">): boolean {
  return getCommunityKindCapabilities(typeof subject === "string" ? subject : subject.kind).supportsTextChannels;
}

export function supportsLiveRadio(subject: CommunityKind | Pick<Community, "kind">): boolean {
  return getCommunityKindCapabilities(typeof subject === "string" ? subject : subject.kind).supportsLiveRadio;
}

export function supportsPodcastPublishing(subject: CommunityKind | Pick<Community, "kind">): boolean {
  return getCommunityKindCapabilities(typeof subject === "string" ? subject : subject.kind).supportsPodcastPublishing;
}

export interface Role {
  id: RoleId;
  name: RoleName;
  color: string;
  level: number;
  capabilities?: readonly string[];
}

export interface Member {
  id: MemberId;
  userId: UserId;
  displayName: string;
  username: string;
  avatarSeed: string;
  avatarUrl?: string;
  verification?: VerificationSummary;
  status: UserStatus;
  statusText: string;
  roleId: RoleId;
  bio?: string;
  isBot?: boolean;
}

export interface Reaction {
  emoji: string;
  count: number;
  reactedByCurrentUser?: boolean;
}

export interface Attachment {
  id: AttachmentId;
  type: AttachmentType;
  url: string;
  publicUrl?: string | null;
  thumbnailUrl?: string | null;
  storagePath?: string;
  mimeType?: string;
  alt: string;
  width?: number;
  height?: number;
  blurhashPlaceholder?: string | null;
  scanStatus?: AttachmentScanStatus;
}

export interface Message {
  id: MessageId;
  clientMessageId?: string | null;
  sequence?: number | null;
  localOrder?: number;
  channelId: ChannelId;
  authorId: UserId;
  webhookId?: string;
  webhookName?: string;
  body: string;
  createdAt: string;
  editedAt?: string;
  deletedAt?: string;
  replyToMessageId?: MessageId | null;
  attachments?: Attachment[];
  reactions?: Reaction[];
  localStatus?: MessageDeliveryStatus;
  poll?: PollData;
  threadId?: string;
}

export interface Channel {
  id: ChannelId;
  name: string;
  type: ChannelType;
  topic?: string;
  isPrivate?: boolean;
  publicReadEnabled?: boolean;
  unread?: boolean;
  mentions?: number;
  categoryId?: CategoryId;
  position?: number;
}

export interface ChannelCategory {
  id: CategoryId;
  name: string;
  channels: Channel[];
  collapsedByDefault?: boolean;
  position?: number;
}

export interface Community {
  id: CommunityId;
  kind: CommunityKind;
  ownerId?: UserId;
  name: string;
  icon: string;
  accentColor: string;
  verification?: VerificationSummary;
  description?: string | null;
  visibility?: "public" | "private";
  publicReadEnabled?: boolean;
  rulesEnabled?: boolean;
  rulesVersion?: string;
  discoveryListed?: boolean;
  discoveryCategory?: "development" | "design" | "gaming" | "music" | "study" | "work";
  discoveryJoinPolicy?: "open" | "request";
  categories: ChannelCategory[];
  roles: Role[];
  members: Member[];
  messages: Message[];
}

export interface CurrentUserState {
  userId: UserId;
  activeCommunityId: CommunityId;
  activeChannelId: ChannelId;
}
