export type ForumPost = Readonly<{ id: string; channelId: string; title: string; authorId: string; tags: string[]; replyCount: number; lastActivityAt: string; status: "open" | "resolved" }>;
