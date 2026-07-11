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
  reason: string;
}>;

export type FriendState = Readonly<{
  friends: FriendConnection[];
  requests: FriendRequest[];
  suggestions: FriendSuggestion[];
}>;
