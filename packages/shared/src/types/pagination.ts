export type PaginationRequest = Readonly<{
  cursor?: string | null;
  limit?: number;
}>;

export type PaginatedResponse<TItem> = Readonly<{
  items: TItem[];
  nextCursor: string | null;
  previousCursor?: string | null;
  hasMore: boolean;
  limit: number;
}>;
