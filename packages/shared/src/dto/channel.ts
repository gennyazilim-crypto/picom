import type { ChannelType, ISODateString, UUIDString } from "../types/common";

export type ChannelDTO = Readonly<{
  id: UUIDString;
  communityId: UUIDString;
  categoryId?: UUIDString | null;
  name: string;
  type: ChannelType;
  topic?: string | null;
  isPrivate: boolean;
  position: number;
  createdAt?: ISODateString | null;
  updatedAt?: ISODateString | null;
}>;
