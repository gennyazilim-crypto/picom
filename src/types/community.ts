export type UserStatus = "online" | "idle" | "dnd" | "offline";
export type ChannelType = "text" | "voice";
export type AttachmentType = "image";
export interface Role { id: string; name: "Owner" | "Admin" | "Moderator" | "Member" | "Guest"; color: string; level: number; }
export interface Member { id: string; userId: string; displayName: string; username: string; avatarSeed: string; status: UserStatus; statusText: string; roleId: string; bio?: string; }
export interface Reaction { emoji: string; count: number; reactedByCurrentUser?: boolean; }
export interface Attachment { id: string; type: AttachmentType; url: string; alt: string; }
export interface Message { id: string; channelId: string; authorId: string; body: string; createdAt: string; editedAt?: string; attachments?: Attachment[]; reactions?: Reaction[]; }
export interface Channel { id: string; name: string; type: ChannelType; topic?: string; isPrivate?: boolean; unread?: boolean; mentions?: number; }
export interface ChannelCategory { id: string; name: string; channels: Channel[]; collapsedByDefault?: boolean; }
export interface Community { id: string; name: string; icon: string; accentColor: string; categories: ChannelCategory[]; roles: Role[]; members: Member[]; messages: Message[]; }
