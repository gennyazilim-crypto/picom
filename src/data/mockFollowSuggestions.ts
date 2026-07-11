import { currentUserId, mockCommunities } from "./mockCommunities";
import type { Member } from "../types/community";
import { selectMockFixture } from "../config/dataSourcePolicy";

const uniqueMembers = new Map<string, Member>();

for (const community of mockCommunities) {
  for (const member of community.members) {
    if (member.userId !== currentUserId && !uniqueMembers.has(member.userId)) {
      uniqueMembers.set(member.userId, member);
    }
  }
}

const rawMockFollowSuggestions = [...uniqueMembers.values()]
  .sort((left, right) => {
    const statusScore = { online: 0, idle: 1, dnd: 2, offline: 3 } as const;
    return statusScore[left.status] - statusScore[right.status] || left.displayName.localeCompare(right.displayName);
  })
  .slice(0, 8);

export const mockFollowSuggestions = selectMockFixture<Member[]>(rawMockFollowSuggestions, []);
