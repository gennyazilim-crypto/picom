import type { ISODateString, UUIDString } from "../types/common";

export type NotificationDTO = Readonly<{
  id: UUIDString;
  userId: UUIDString;
  communityId?: UUIDString | null;
  channelId?: UUIDString | null;
  messageId?: UUIDString | null;
  type: "mention" | "message" | "system" | "invite" | "moderation";
  title: string;
  body: string;
  readAt?: ISODateString | null;
  createdAt: ISODateString;
}>;
