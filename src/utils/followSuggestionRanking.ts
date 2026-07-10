import type { Community, Member } from "../types/community";
import type { MentionItem } from "../types/mentions";

export type FollowSuggestion = Readonly<{
  member: Member;
  score: number;
  reasons: readonly string[];
}>;

export type FollowSuggestionOptions = Readonly<{
  candidates: readonly Member[];
  communities: readonly Community[];
  accessibleMentions: readonly MentionItem[];
  currentUserId: string;
  followedUserIds: readonly string[];
  blockedUserIds: readonly string[];
  nowMs?: number;
  limit?: number;
}>;

const DAY_MS = 24 * 60 * 60 * 1000;

function roleName(community: Community, member: Member): string | null {
  return community.roles.find((role) => role.id === member.roleId)?.name ?? null;
}

function uniqueMembers(candidates: readonly Member[]): Member[] {
  return [...new Map(candidates.map((member) => [member.userId, member])).values()];
}

export function rankFollowSuggestions(options: FollowSuggestionOptions): FollowSuggestion[] {
  const followed = new Set(options.followedUserIds);
  const blocked = new Set(options.blockedUserIds);
  const nowMs = options.nowMs ?? Date.now();
  const recentCutoff = nowMs - 30 * DAY_MS;

  return uniqueMembers(options.candidates)
    .filter((member) => member.userId !== options.currentUserId && !member.isBot && !followed.has(member.userId) && !blocked.has(member.userId))
    .map((member): FollowSuggestion | null => {
      const mutualCommunities = options.communities.filter((community) =>
        community.members.some((candidate) => candidate.userId === options.currentUserId)
        && community.members.some((candidate) => candidate.userId === member.userId));
      if (mutualCommunities.length === 0) return null;

      const roleMatches = mutualCommunities.filter((community) => {
        const current = community.members.find((candidate) => candidate.userId === options.currentUserId);
        return Boolean(current && roleName(community, current) === roleName(community, member));
      }).length;
      const recentMentions = options.accessibleMentions.filter((mention) => {
        const createdAt = Date.parse(mention.createdAt);
        return Number.isFinite(createdAt) && createdAt >= recentCutoff
          && (mention.authorId === member.userId || mention.mentionedUserIds.includes(member.userId));
      });
      const popularity = recentMentions.reduce((total, mention) => total + Math.min(Math.max(mention.popularityScore ?? 0, 0), 100), 0);
      const score = Math.min(mutualCommunities.length, 3) * 20
        + Math.min(roleMatches, 2) * 8
        + Math.min(recentMentions.length, 5) * 5
        + Math.min(popularity / 20, 20);
      const reasons = [
        `${mutualCommunities.length} mutual communit${mutualCommunities.length === 1 ? "y" : "ies"}`,
        ...(roleMatches > 0 ? ["Relevant community role"] : []),
        ...(recentMentions.length > 0 ? ["Recent visible mentions"] : []),
      ];

      return { member, score, reasons } satisfies FollowSuggestion;
    })
    .filter((suggestion): suggestion is FollowSuggestion => suggestion !== null)
    .sort((left, right) => right.score - left.score || left.member.displayName.localeCompare(right.member.displayName) || left.member.userId.localeCompare(right.member.userId))
    .slice(0, Math.min(Math.max(options.limit ?? 10, 1), 20));
}
