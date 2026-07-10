export type CommunityEmojiModerationStatus = "active" | "disabled";

export type CommunityEmoji = Readonly<{
  id: string;
  communityId: string;
  name: string;
  imageUrl: string;
  storagePath?: string;
  createdBy: string;
  createdAt: string;
  moderationStatus: CommunityEmojiModerationStatus;
  disabledAt?: string;
  deletedAt?: string;
}>;

export type CommunitySticker = Readonly<{ id: string; name: string; title: string; tone: "teal" | "orange" | "aqua" | "neutral" }>;
