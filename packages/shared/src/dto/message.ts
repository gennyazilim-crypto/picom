import type { ISODateString, UUIDString } from "../types/common";
import type { AttachmentDTO } from "./attachment";

export type ReactionDTO = Readonly<{
  emoji: string;
  count: number;
  reactedByCurrentUser?: boolean;
}>;

export type MessageDTO = Readonly<{
  id: UUIDString;
  communityId: UUIDString;
  channelId: UUIDString;
  authorId: UUIDString;
  body: string;
  clientMessageId?: string | null;
  replyToMessageId?: UUIDString | null;
  attachments?: AttachmentDTO[];
  reactions?: ReactionDTO[];
  createdAt: ISODateString;
  editedAt?: ISODateString | null;
  deletedAt?: ISODateString | null;
}>;
