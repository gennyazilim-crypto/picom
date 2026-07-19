import { currentUserId } from "./mockMembers";

const rawMockPopularUserIds = import.meta.env.PROD ? [] : [
  "aurora-user-1",
  "aurora-user-2",
  "north-user-1",
  "north-user-2",
  "terra-user-1",
  "terra-user-2",
  "pixel-user-1",
  "orbit-user-1",
] as const;

const rawMockFollowedUserIdsByUser: Record<string, string[]> = import.meta.env.PROD ? {} : {
  [currentUserId]: [
    "aurora-user-1",
    "aurora-user-2",
    "north-user-1",
    "terra-user-1",
    "pixel-user-1",
    "orbit-user-2",
  ],
};

export const mockPopularUserIds: readonly string[] = import.meta.env.PROD ? [] : rawMockPopularUserIds;
export const mockFollowedUserIdsByUser: Record<string, string[]> = import.meta.env.PROD ? {} : rawMockFollowedUserIdsByUser;
export const currentUserFollowedUserIds = mockFollowedUserIdsByUser[currentUserId] ?? [];
