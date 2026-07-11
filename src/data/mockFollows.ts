import { currentUserId } from "./mockMembers";
import { selectMockFixture } from "../config/dataSourcePolicy";

const rawMockPopularUserIds = [
  "aurora-user-1",
  "aurora-user-2",
  "north-user-1",
  "north-user-2",
  "terra-user-1",
  "terra-user-2",
  "pixel-user-1",
  "orbit-user-1",
] as const;

const rawMockFollowedUserIdsByUser: Record<string, string[]> = {
  [currentUserId]: [
    "aurora-user-1",
    "aurora-user-2",
    "north-user-1",
    "terra-user-1",
    "pixel-user-1",
    "orbit-user-2",
  ],
};

export const mockPopularUserIds = selectMockFixture<readonly string[]>(rawMockPopularUserIds, []);
export const mockFollowedUserIdsByUser = selectMockFixture<Record<string, string[]>>(rawMockFollowedUserIdsByUser, {});
export const currentUserFollowedUserIds = mockFollowedUserIdsByUser[currentUserId] ?? [];
