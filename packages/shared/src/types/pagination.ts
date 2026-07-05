export type PaginationCursor = string | null;

export type PaginationDirection = "forward" | "backward";

export type PaginatedEndpointName =
  | "messages"
  | "notifications"
  | "auditLogs"
  | "members"
  | "searchResults"
  | "reports"
  | "savedMessages"
  | "accountActivity"
  | "adminList";

export type PaginationRequest = Readonly<{
  cursor?: PaginationCursor;
  previousCursor?: PaginationCursor;
  limit?: number;
  direction?: PaginationDirection;
}>;

export type PaginationMeta = Readonly<{
  nextCursor: PaginationCursor;
  previousCursor?: PaginationCursor;
  hasMore: boolean;
  limit: number;
}>;

export type PaginatedResponse<TItem> = Readonly<{
  items: TItem[];
  nextCursor: PaginationCursor;
  previousCursor?: PaginationCursor;
  hasMore: boolean;
  limit: number;
}>;
