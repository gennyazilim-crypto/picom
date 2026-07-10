export type CommunityEmoji = Readonly<{ id: string; communityId: string; name: string; imageUrl: string; createdBy: string; createdAt: string; deletedAt?: string }>;
export type CommunitySticker = Readonly<{ id: string; name: string; title: string; tone: "teal" | "orange" | "aqua" | "neutral" }>;
