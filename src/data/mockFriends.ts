import type { FriendState } from "../types/friends";

export const mockFriendState: FriendState = {
  friends: [
    {
      userId: "u-naines",
      displayName: "Nainesh Selarka",
      username: "nainesh",
      status: "online",
      statusText: "Designing on Figma",
      favorite: true,
      mutualCommunityCount: 3,
    },
    {
      userId: "u-krishna",
      displayName: "Krishna",
      username: "krishna",
      status: "idle",
      statusText: "Coding on VS Code",
      favorite: false,
      mutualCommunityCount: 2,
    },
    {
      userId: "u-radha",
      displayName: "Radha",
      username: "radha",
      status: "offline",
      statusText: "Offline",
      favorite: false,
      mutualCommunityCount: 1,
    },
  ],
  requests: [
    {
      id: "friend-request-govind",
      userId: "u-govind",
      displayName: "Govind",
      username: "govind",
      direction: "incoming",
      note: "Met in the beta design community.",
      createdAt: "2026-07-04T13:20:00.000Z",
    },
    {
      id: "friend-request-madhav",
      userId: "u-madhav",
      displayName: "Madhav",
      username: "madhav",
      direction: "outgoing",
      note: "Pending placeholder request.",
      createdAt: "2026-07-04T09:12:00.000Z",
    },
  ],
  suggestions: [
    {
      userId: "u-keshav",
      displayName: "Keshav",
      username: "keshav",
      reason: "Active in two shared channels.",
    },
    {
      userId: "u-shyaam",
      displayName: "Shyaam",
      username: "shyaam",
      reason: "Mentioned in popular beta feed items.",
    },
  ],
};
