import type { MessageDTO } from "../dto/message";
import type { ISODateString, UUIDString } from "../types/common";

export type RealtimeEventBase = Readonly<{
  eventId: string;
  communityId?: UUIDString;
  channelId?: UUIDString;
  serverTimestamp: ISODateString;
}>;

export type MessageRealtimeEvent =
  | Readonly<RealtimeEventBase & { type: "message:new"; message: MessageDTO }>
  | Readonly<RealtimeEventBase & { type: "message:update"; message: MessageDTO }>
  | Readonly<RealtimeEventBase & { type: "message:delete"; messageId: UUIDString }>
  | Readonly<RealtimeEventBase & { type: "message:reaction:add"; messageId: UUIDString; emoji: string; userId: UUIDString }>
  | Readonly<RealtimeEventBase & { type: "message:reaction:remove"; messageId: UUIDString; emoji: string; userId: UUIDString }>;

export type TypingRealtimeEvent =
  | Readonly<RealtimeEventBase & { type: "typing:start"; userId: UUIDString; displayName: string }>
  | Readonly<RealtimeEventBase & { type: "typing:stop"; userId: UUIDString }>;

export type ChannelReadRealtimeEvent = Readonly<RealtimeEventBase & {
  type: "channel:read";
  userId: UUIDString;
  lastReadMessageId?: UUIDString | null;
}>;

export type RealtimeEvent = MessageRealtimeEvent | TypingRealtimeEvent | ChannelReadRealtimeEvent;
