export type CommunityId = string;
export type ChannelId = string;
export type CategoryId = string;
export type MessageId = string;
export type MemberId = string;
export type UserId = string;
export type RoleId = string;
export type AttachmentId = string;

export type UserStatus = "online" | "idle" | "dnd" | "offline";
export type ChannelType = "text" | "voice";
export type AttachmentType = "image";
export type AttachmentScanStatus = "pending" | "clean" | "suspicious" | "failed" | "skipped_development";
export type RoleName = "Owner" | "Admin" | "Moderator" | "Member" | "Guest";

export interface Role {
  id: RoleId;
  name: RoleName;
  color: string;
  level: number;
}

export interface Member {
  id: MemberId;
  userId: UserId;
  displayName: string;
  username: string;
  avatarSeed: string;
  avatarUrl?: string;
  status: UserStatus;
  statusText: string;
  roleId: RoleId;
  bio?: string;
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
  channelId: ChannelId;
  authorId: UserId;
  body: string;
  createdAt: string;
  editedAt?: string;
  deletedAt?: string;
  replyToMessageId?: MessageId | null;
  attachments?: Attachment[];
  reactions?: Reaction[];
  localStatus?: "sent" | "sending" | "failed";
}

export interface Channel {
  id: ChannelId;
  name: string;
  type: ChannelType;
  topic?: string;
  isPrivate?: boolean;
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
  name: string;
  icon: string;
  accentColor: string;
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
