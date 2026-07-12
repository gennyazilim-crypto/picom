import {
  FEED_SCORE_V1,
  calculateFeedEngagementRollup,
  calculateFeedFinalScore,
  calculateFeedFreshnessDecay,
  calculateFeedRawScore,
  calculateFeedRelevanceScore,
  getFeedBaseScore,
  getFeedGroupPriority,
  isFeedCandidateEligible,
  type FeedScoreActor,
  type FeedScoreEvent,
} from "../services/feed/feedScoreV1";
import type { FeedContentKind } from "../types/feed";

const actor = (id: string, flags: Partial<FeedScoreActor> = {}): FeedScoreActor => ({ id, ...flags });
const event = (id: string, actorId: string, kind: FeedScoreEvent["kind"], flags: Partial<FeedScoreEvent> = {}): FeedScoreEvent => ({
  id,
  actor: actor(actorId),
  kind,
  ...flags,
});

export const feedScoreV1BaseFixtures: readonly Readonly<{ kind: FeedContentKind; expected: number }>[] = [
  { kind: "text_only", expected: 1 },
  { kind: "image_only", expected: 2 },
  { kind: "text_image", expected: 3 },
  { kind: "video_only", expected: 4 },
  { kind: "text_video", expected: 5 },
  { kind: "image_video", expected: 5 },
  { kind: "text_image_video", expected: 6 },
];

export function runFeedScoreV1Fixtures(): readonly string[] {
  const failures: string[] = [];
  const expect = (condition: boolean, message: string) => { if (!condition) failures.push(message); };

  for (const fixture of feedScoreV1BaseFixtures) {
    expect(getFeedBaseScore("text_message", fixture.kind) === fixture.expected, `${fixture.kind} base score`);
  }

  const duplicateAndInvalidEvents: FeedScoreEvent[] = [
    event("reaction-1", "user-1", "reaction"),
    event("reaction-2", "user-1", "reaction"),
    event("reaction-2", "user-1", "reaction"),
    event("reaction-self", "author-1", "reaction"),
    { ...event("reaction-bot", "bot-1", "reaction"), actor: actor("bot-1", { isBot: true }) },
    event("comment-1", "user-2", "comment"),
    event("comment-2", "user-2", "comment"),
    event("comment-3", "user-2", "comment"),
    event("comment-deleted", "user-3", "comment", { deletedAt: "2026-07-12T00:00:00.000Z" }),
    event("save-1", "user-1", "save"),
    event("view-1", "user-4", "view"),
    event("view-2", "user-4", "view"),
    event("view-moderated", "user-5", "view", { moderatedAt: "2026-07-12T00:00:00.000Z" }),
  ];
  const rollup = calculateFeedEngagementRollup("author-1", duplicateAndInvalidEvents);
  expect(rollup.uniqueExternalReactors === 1 && rollup.reactionScore === 1, "reaction actor deduplication");
  expect(rollup.uniqueExternalCommenters === 1 && rollup.commentScore === 3, "commenter and additional reply scoring");
  expect(rollup.uniqueExternalSavers === 1 && rollup.saveScore === 2, "save scoring");
  expect(rollup.uniqueExternalViewers === 1 && rollup.viewScore === 0.1, "view actor deduplication");
  expect(rollup.externalSupporterCount === 2, "supporter union excludes views");
  expect(calculateFeedRawScore(3, rollup) === 9.1, "raw score composition");

  const cappedEvents: FeedScoreEvent[] = [];
  for (let index = 0; index < 40; index += 1) {
    cappedEvents.push(event(`reaction-${index}`, `reactor-${index}`, "reaction"));
    cappedEvents.push(event(`save-${index}`, `saver-${index}`, "save"));
    cappedEvents.push(event(`view-${index}`, `viewer-${index}`, "view"));
  }
  for (let index = 0; index < 20; index += 1) cappedEvents.push(event(`comment-${index}`, "repeat-commenter", "comment"));
  const capped = calculateFeedEngagementRollup("author-1", cappedEvents);
  expect(capped.reactionScore === 10, "reaction cap");
  expect(capped.saveScore === 10, "save cap");
  expect(capped.viewScore === 3, "view cap");
  expect(capped.commentScore === 4, "additional replies are capped at +2 per commenter");

  expect(!isFeedCandidateEligible({ rawScore: 4, externalSupporterCount: 0, isDirectMention: false, isAccessible: true }), "video-only without support is ineligible");
  expect(isFeedCandidateEligible({ rawScore: 4, externalSupporterCount: 1, isDirectMention: false, isAccessible: true }), "text-image plus reaction is eligible");
  expect(isFeedCandidateEligible({ rawScore: 1, externalSupporterCount: 0, isDirectMention: true, isAccessible: true }), "accessible direct mention guarantee");
  expect(!isFeedCandidateEligible({ rawScore: 100, externalSupporterCount: 10, isDirectMention: true, isAccessible: false }), "access always wins");

  expect(calculateFeedRelevanceScore({ isDirectMention: true, isFriendAuthor: true, isFriendEngaged: true, isUnread: true, isRecentCommunity: true }) === 13, "relevance configuration");
  const asOf = "2026-07-12T12:00:00.000Z";
  expect(calculateFeedFreshnessDecay(asOf, asOf) === 1, "freshness age zero");
  expect(calculateFeedFreshnessDecay("2026-07-10T12:00:00.000Z", asOf) === 0.5, "freshness 48-hour half-life");
  expect(calculateFeedFreshnessDecay("2026-07-08T12:00:00.000Z", asOf) === 0.25, "freshness 96 hours");
  expect(calculateFeedFinalScore(4, 8, "2026-07-10T12:00:00.000Z", asOf) === 6, "final score");

  expect(getFeedGroupPriority({ isDirectMention: true, isUnread: true, isFriendAuthor: false, isFriendEngaged: false }) === 1, "unread mention priority");
  expect(getFeedGroupPriority({ isDirectMention: false, isUnread: false, isFriendAuthor: true, isFriendEngaged: false }) === 2, "friend priority");
  expect(getFeedGroupPriority({ isDirectMention: false, isUnread: false, isFriendAuthor: false, isFriendEngaged: false }) === 3, "popular priority");
  expect(getFeedGroupPriority({ isDirectMention: true, isUnread: false, isFriendAuthor: false, isFriendEngaged: false }) === 4, "read mention priority");
  expect(FEED_SCORE_V1.diversity.windowSize === 20 && FEED_SCORE_V1.freshness.halfLifeHours === 48, "versioned limits");
  return failures;
}

