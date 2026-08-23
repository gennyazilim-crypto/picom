export const bookmarkContentTypes = ["feed", "message", "radio", "podcast", "event", "file", "link"] as const;

export type BookmarkContentType = (typeof bookmarkContentTypes)[number];

export type BookmarkMetadata = Readonly<{
  title?: string;
  preview?: string;
  url?: string;
  imageUrl?: string;
  communityId?: string;
  channelId?: string;
  authorId?: string;
  sourceLabel?: string;
  startsAt?: string;
}>;

export type BookmarkCollection = Readonly<{
  id: string;
  name: string;
  createdAt: string;
}>;

export type BookmarkRecord = Readonly<{
  id: string;
  userId: string;
  collectionId?: string;
  contentType: BookmarkContentType;
  contentId: string;
  metadata: BookmarkMetadata;
  createdAt: string;
  updatedAt: string;
}>;

export type CreateBookmarkInput = Readonly<{
  contentType: BookmarkContentType;
  contentId: string;
  collectionId?: string;
  metadata?: BookmarkMetadata;
}>;
