import type { UserStatus } from "./community";

export type FriendConnection = Readonly<{
  id?: string;
  userId: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
  status: UserStatus;
  statusText: string;
  favorite: boolean;
  mutualCommunityCount: number;
}>;

export type FriendRequestStatus = "pending" | "accepted" | "declined" | "cancelled";
export type FriendViewTab = "all" | "online" | "pending" | "suggestions" | "blocked";

export type FriendServiceErrorCode =
  | "INVALID_INPUT"
  | "AUTH_REQUIRED"
  | "SELF_REQUEST"
  | "BLOCKED"
  | "PRIVACY_DENIED"
  | "DUPLICATE_REQUEST"
  | "ALREADY_FRIENDS"
  | "COOLDOWN"
  | "NOT_FOUND"
  | "DIRECTION_DENIED"
  | "RATE_LIMITED"
  | "NETWORK"
  | "UNKNOWN";

export type FriendServiceError = Readonly<{
  code: FriendServiceErrorCode;
  message: string;
  retryable: boolean;
}>;

export type FriendServiceResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{ ok: false; error: string; details: FriendServiceError }>;

export type FriendRequestCounts = Readonly<{
  friends: number;
  incoming: number;
  outgoing: number;
  pending: number;
}>;

export type FriendRequest = Readonly<{
  id: string;
  userId: string;
  displayName: string;
  username: string;
  direction: "incoming" | "outgoing";
  status: FriendRequestStatus;
  note: string;
  createdAt: string;
}>;

export type FriendNotification = Readonly<{
  id: string;
  actorUserId: string;
  eventType: "request_sent" | "request_accepted";
  requestId?: string;
  createdAt: string;
}>;

export type FriendSuggestion = Readonly<{
  userId: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
  reason: string;
  mutualCommunityCount: number;
  followedByCurrentUser: boolean;
}>;

export type FriendState = Readonly<{
  friends: FriendConnection[];
  requests: FriendRequest[];
  suggestions: FriendSuggestion[];
  counts: FriendRequestCounts;
}>;
