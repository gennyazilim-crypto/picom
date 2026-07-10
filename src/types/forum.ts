export type ForumPost = Readonly<{
  id: string;
  communityId: string;
  channelId: string;
  parentMessageId: string;
  threadId: string;
  title: string;
  body: string;
  authorId: string;
  tags: string[];
  replyCount: number;
  lastActivityAt: string;
  createdAt: string;
  status: "open" | "resolved";
}>;

export type CreateForumPostInput = Readonly<{ communityId: string; channelId: string; title: string; body: string; tags: string[]; authorId: string }>;
