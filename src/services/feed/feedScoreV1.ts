import type { FeedContentKind, FeedSourceType } from "../../types/feed";

export const FEED_SCORE_V1 = Object.freeze({
  version: 1,
  scorePrecision: 6,
  textBaseScores: Object.freeze<Record<FeedContentKind, number>>({
    text_only: 1,
    image_only: 2,
    text_image: 3,
    video_only: 4,
    text_video: 5,
    image_video: 5,
    text_image_video: 6,
  }),
  sourceBaseScores: Object.freeze<Record<Exclude<FeedSourceType, "text_message">, number>>({
    radio_session: 4,
    radio_comment: 1,
    podcast_episode: 4,
    podcast_comment: 1,
  }),
  engagement: Object.freeze({
    reactionWeight: 1,
    reactionCap: 10,
    uniqueCommenterWeight: 2,
    uniqueCommenterCap: 20,
    additionalReplyWeight: 0.5,
    additionalReplyPerCommenterCap: 2,
    saveWeight: 2,
    saveCap: 10,
    viewWeight: 0.1,
    viewCap: 3,
  }),
  relevance: Object.freeze({
    directMention: 8,
    friendAuthor: 2,
    friendEngaged: 1,
    unread: 1,
    recentCommunity: 1,
  }),
  eligibility: Object.freeze({
    minimumRawScore: 4,
    minimumExternalSupporters: 1,
  }),
  freshness: Object.freeze({ halfLifeHours: 48 }),
  diversity: Object.freeze({
    windowSize: 20,
    maxPerAuthor: 2,
    maxPerCommunity: 4,
    maxConsecutivePerCommunity: 2,
  }),
  groupPriority: Object.freeze({
    unreadDirectMention: 1,
    friendRelated: 2,
    popular: 3,
    readDirectMention: 4,
  }),
} as const);

export type FeedScoreActor = Readonly<{
  id: string;
  isBot?: boolean;
  isSystem?: boolean;
  isBanned?: boolean;
  isDeactivated?: boolean;
}>;

export type FeedScoreEvent = Readonly<{
  id: string;
  actor: FeedScoreActor;
  kind: "reaction" | "comment" | "save" | "view";
  deletedAt?: string | null;
  moderatedAt?: string | null;
  isValid?: boolean;
}>;

export type FeedEngagementRollup = Readonly<{
  uniqueExternalReactors: number;
  uniqueExternalCommenters: number;
  additionalReplyCount: number;
  uniqueExternalSavers: number;
  uniqueExternalViewers: number;
  externalSupporterCount: number;
  reactionScore: number;
  commentScore: number;
  saveScore: number;
  viewScore: number;
  totalScore: number;
}>;

export type FeedRelevanceInput = Readonly<{
  isDirectMention: boolean;
  isFriendAuthor: boolean;
  isFriendEngaged: boolean;
  isUnread: boolean;
  isRecentCommunity: boolean;
}>;

export type FeedGroupPriority = 1 | 2 | 3 | 4;

function roundScore(value: number): number {
  const factor = 10 ** FEED_SCORE_V1.scorePrecision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function isEligibleActor(actor: FeedScoreActor, authorId: string): boolean {
  return Boolean(
    actor.id
    && actor.id !== authorId
    && !actor.isBot
    && !actor.isSystem
    && !actor.isBanned
    && !actor.isDeactivated,
  );
}

function isEligibleEvent(event: FeedScoreEvent, authorId: string): boolean {
  return event.isValid !== false
    && !event.deletedAt
    && !event.moderatedAt
    && isEligibleActor(event.actor, authorId);
}

export function getFeedBaseScore(sourceType: FeedSourceType, contentKind?: FeedContentKind): number {
  if (sourceType === "text_message") {
    if (!contentKind) throw new Error("FEED_TEXT_CONTENT_KIND_REQUIRED");
    return FEED_SCORE_V1.textBaseScores[contentKind];
  }
  return FEED_SCORE_V1.sourceBaseScores[sourceType];
}

export function calculateFeedEngagementRollup(
  authorId: string,
  events: readonly FeedScoreEvent[],
): FeedEngagementRollup {
  const seenEvents = new Set<string>();
  const reactors = new Set<string>();
  const commenters = new Map<string, number>();
  const savers = new Set<string>();
  const viewers = new Set<string>();

  for (const event of events) {
    if (!event.id || seenEvents.has(event.id) || !isEligibleEvent(event, authorId)) continue;
    seenEvents.add(event.id);
    if (event.kind === "reaction") reactors.add(event.actor.id);
    if (event.kind === "comment") commenters.set(event.actor.id, (commenters.get(event.actor.id) ?? 0) + 1);
    if (event.kind === "save") savers.add(event.actor.id);
    if (event.kind === "view") viewers.add(event.actor.id);
  }

  const reactionScore = Math.min(
    FEED_SCORE_V1.engagement.reactionCap,
    reactors.size * FEED_SCORE_V1.engagement.reactionWeight,
  );
  const uniqueCommenterScore = Math.min(
    FEED_SCORE_V1.engagement.uniqueCommenterCap,
    commenters.size * FEED_SCORE_V1.engagement.uniqueCommenterWeight,
  );
  let additionalReplyCount = 0;
  let additionalReplyScore = 0;
  for (const count of commenters.values()) {
    const additional = Math.max(0, count - 1);
    additionalReplyCount += additional;
    additionalReplyScore += Math.min(
      FEED_SCORE_V1.engagement.additionalReplyPerCommenterCap,
      additional * FEED_SCORE_V1.engagement.additionalReplyWeight,
    );
  }
  const commentScore = uniqueCommenterScore + additionalReplyScore;
  const saveScore = Math.min(
    FEED_SCORE_V1.engagement.saveCap,
    savers.size * FEED_SCORE_V1.engagement.saveWeight,
  );
  const viewScore = Math.min(
    FEED_SCORE_V1.engagement.viewCap,
    viewers.size * FEED_SCORE_V1.engagement.viewWeight,
  );
  const externalSupporters = new Set([...reactors, ...commenters.keys(), ...savers]);

  return {
    uniqueExternalReactors: reactors.size,
    uniqueExternalCommenters: commenters.size,
    additionalReplyCount,
    uniqueExternalSavers: savers.size,
    uniqueExternalViewers: viewers.size,
    externalSupporterCount: externalSupporters.size,
    reactionScore,
    commentScore,
    saveScore,
    viewScore: roundScore(viewScore),
    totalScore: roundScore(reactionScore + commentScore + saveScore + viewScore),
  };
}

export function calculateFeedRawScore(baseScore: number, engagement: Pick<FeedEngagementRollup, "totalScore">): number {
  return roundScore(Math.max(0, baseScore) + Math.max(0, engagement.totalScore));
}

export function calculateFeedRelevanceScore(input: FeedRelevanceInput): number {
  return (
    (input.isDirectMention ? FEED_SCORE_V1.relevance.directMention : 0)
    + (input.isFriendAuthor ? FEED_SCORE_V1.relevance.friendAuthor : 0)
    + (input.isFriendEngaged ? FEED_SCORE_V1.relevance.friendEngaged : 0)
    + (input.isUnread ? FEED_SCORE_V1.relevance.unread : 0)
    + (input.isRecentCommunity ? FEED_SCORE_V1.relevance.recentCommunity : 0)
  );
}

export function calculateFeedFreshnessDecay(createdAt: string | number | Date, asOf: string | number | Date): number {
  const createdAtMs = new Date(createdAt).getTime();
  const asOfMs = new Date(asOf).getTime();
  if (!Number.isFinite(createdAtMs) || !Number.isFinite(asOfMs)) throw new Error("FEED_SCORE_TIMESTAMP_INVALID");
  const ageHours = Math.max(0, (asOfMs - createdAtMs) / 3_600_000);
  return roundScore(2 ** (-ageHours / FEED_SCORE_V1.freshness.halfLifeHours));
}

export function calculateFeedFinalScore(
  rawScore: number,
  relevanceScore: number,
  createdAt: string | number | Date,
  asOf: string | number | Date,
): number {
  return roundScore((Math.max(0, rawScore) + Math.max(0, relevanceScore)) * calculateFeedFreshnessDecay(createdAt, asOf));
}

export function isFeedCandidateEligible(input: Readonly<{
  rawScore: number;
  externalSupporterCount: number;
  isDirectMention: boolean;
  isAccessible: boolean;
}>): boolean {
  if (!input.isAccessible) return false;
  if (input.isDirectMention) return true;
  return input.rawScore >= FEED_SCORE_V1.eligibility.minimumRawScore
    && input.externalSupporterCount >= FEED_SCORE_V1.eligibility.minimumExternalSupporters;
}

export function getFeedGroupPriority(input: Readonly<{
  isDirectMention: boolean;
  isUnread: boolean;
  isFriendAuthor: boolean;
  isFriendEngaged: boolean;
}>): FeedGroupPriority {
  if (input.isDirectMention && input.isUnread) return FEED_SCORE_V1.groupPriority.unreadDirectMention;
  if (input.isFriendAuthor || input.isFriendEngaged) return FEED_SCORE_V1.groupPriority.friendRelated;
  if (!input.isDirectMention) return FEED_SCORE_V1.groupPriority.popular;
  return FEED_SCORE_V1.groupPriority.readDirectMention;
}

