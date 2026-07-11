import type { ISODateString, UUIDString } from "../types/common";

export type CommunityKindDTO = "text" | "radio" | "podcast";

export type CommunityDTO = Readonly<{
  id: UUIDString;
  kind: CommunityKindDTO;
  name: string;
  description?: string | null;
  iconUrl?: string | null;
  accentColor?: string | null;
  ownerId?: UUIDString | null;
  createdAt?: ISODateString | null;
  updatedAt?: ISODateString | null;
}>;
