import type { AttachmentType, ISODateString, UUIDString } from "../types/common";

export type AttachmentDTO = Readonly<{
  id: UUIDString;
  communityId: UUIDString;
  channelId: UUIDString;
  messageId?: UUIDString | null;
  type: AttachmentType;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url?: string | null;
  thumbnailUrl?: string | null;
  width?: number | null;
  height?: number | null;
  blurhashPlaceholder?: string | null;
  scanStatus?: "pending" | "clean" | "suspicious" | "failed" | "skipped_development";
  createdAt?: ISODateString | null;
}>;
