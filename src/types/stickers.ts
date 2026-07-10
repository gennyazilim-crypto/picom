export type StickerModerationStatus = "active" | "disabled";

export type CommunitySticker = Readonly<{
  id: string;
  packId?: string;
  communityId?: string;
  name: string;
  title: string;
  tone?: "teal" | "orange" | "aqua" | "neutral";
  imageUrl?: string;
  storagePath?: string;
  createdBy?: string;
  createdAt?: string;
  moderationStatus?: StickerModerationStatus;
}>;

export type CommunityStickerPack = Readonly<{
  id: string;
  communityId: string;
  name: string;
  description: string;
  ownerId: string;
  createdAt: string;
  moderationStatus: StickerModerationStatus;
  stickers: CommunitySticker[];
}>;
