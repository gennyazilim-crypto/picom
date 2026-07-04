import { currentUserId } from "./mockMembers";

export const mockPopularUserIds = [
  "aurora-user-1",
  "aurora-user-2",
  "north-user-1",
  "north-user-2",
  "terra-user-1",
  "terra-user-2",
  "pixel-user-1",
  "orbit-user-1",
] as const;

export const mockFollowedUserIdsByUser: Record<string, string[]> = {
  [currentUserId]: [
    "aurora-user-1",
    "aurora-user-2",
    "north-user-1",
    "terra-user-1",
    "pixel-user-1",
    "orbit-user-2",
  ],
};

export const currentUserFollowedUserIds = mockFollowedUserIdsByUser[currentUserId] ?? [];
