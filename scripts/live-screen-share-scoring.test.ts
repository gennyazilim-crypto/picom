import assert from "node:assert/strict";
import { test } from "node:test";
import type { LiveScreenShareSummary } from "../src/types/liveScreenShare";
import {
  computeClientRelevanceScore,
  formatLiveBadge,
  selectFeaturedLiveShare,
  sortLiveShares,
} from "../src/services/live/liveScreenShareScoring.ts";

function makeShare(overrides: Partial<LiveScreenShareSummary> = {}): LiveScreenShareSummary {
  return {
    id: "share-1",
    livekitRoomName: "community:c1:voice:ch1",
    communityId: "c1",
    channelId: "ch1",
    broadcasterUserId: "u1",
    title: "Ranked queue",
    category: "game",
    applicationName: "Valorant",
    status: "live",
    startedAt: "2026-07-29T00:00:00.000Z",
    endedAt: null,
    viewerCount: 0,
    participantCount: 1,
    previewUpdatedAt: null,
    communityName: "Community One",
    channelName: "voice-1",
    broadcasterDisplayName: "Broadcaster",
    broadcasterUsername: "broadcaster",
    friendViewerIds: [],
    relevanceScore: 0,
    ...overrides,
  };
}

test("formatLiveBadge hides the badge for zero or negative counts", () => {
  assert.equal(formatLiveBadge(0), null);
  assert.equal(formatLiveBadge(-4), null);
});

test("formatLiveBadge returns the raw integer under the cap", () => {
  assert.equal(formatLiveBadge(1), 1);
  assert.equal(formatLiveBadge(42), 42);
  assert.equal(formatLiveBadge(99), 99);
});

test("formatLiveBadge caps large counts at '99+'", () => {
  assert.equal(formatLiveBadge(100), "99+");
  assert.equal(formatLiveBadge(1000), "99+");
});

test("formatLiveBadge floors fractional counts", () => {
  assert.equal(formatLiveBadge(3.9), 3);
});

test("formatLiveBadge treats non-finite input as hidden", () => {
  assert.equal(formatLiveBadge(Number.NaN), null);
  assert.equal(formatLiveBadge(Number.POSITIVE_INFINITY), null);
});

test("computeClientRelevanceScore rewards membership, following, viewers, recency, and live status", () => {
  const now = Date.parse("2026-07-29T00:20:00.000Z");
  const score = computeClientRelevanceScore({
    isMember: true,
    isFollowingBroadcaster: true,
    viewerCount: 12,
    startedAt: "2026-07-29T00:10:00.000Z",
    status: "live",
    now,
  });
  assert.equal(score, 40 + 25 + 12 + 12 + 8);
});

test("computeClientRelevanceScore caps the viewer bonus at 50", () => {
  const now = Date.parse("2026-07-29T01:00:00.000Z");
  const score = computeClientRelevanceScore({
    isMember: false,
    isFollowingBroadcaster: false,
    viewerCount: 500,
    startedAt: "2026-07-29T00:00:00.000Z",
    status: "reconnecting",
    now,
  });
  assert.equal(score, 50);
});

test("computeClientRelevanceScore drops the recency bonus once outside the 15 minute window", () => {
  const now = Date.parse("2026-07-29T01:00:00.000Z");
  const score = computeClientRelevanceScore({
    isMember: false,
    isFollowingBroadcaster: false,
    viewerCount: 0,
    startedAt: "2026-07-29T00:00:00.000Z",
    status: "live",
    now,
  });
  assert.equal(score, 8);
});

test("sortLiveShares orders by viewers descending", () => {
  const items = [makeShare({ id: "a", viewerCount: 3 }), makeShare({ id: "b", viewerCount: 9 }), makeShare({ id: "c", viewerCount: 1 })];
  assert.deepEqual(sortLiveShares(items, "viewers").map((item) => item.id), ["b", "a", "c"]);
});

test("sortLiveShares orders by newest first", () => {
  const items = [
    makeShare({ id: "old", startedAt: "2026-07-28T00:00:00.000Z" }),
    makeShare({ id: "new", startedAt: "2026-07-29T00:00:00.000Z" }),
  ];
  assert.deepEqual(sortLiveShares(items, "newest").map((item) => item.id), ["new", "old"]);
});

test("sortLiveShares orders by longest running (oldest first)", () => {
  const items = [
    makeShare({ id: "old", startedAt: "2026-07-28T00:00:00.000Z" }),
    makeShare({ id: "new", startedAt: "2026-07-29T00:00:00.000Z" }),
  ];
  assert.deepEqual(sortLiveShares(items, "longest").map((item) => item.id), ["old", "new"]);
});

test("sortLiveShares defaults to relevanceScore for recommended sort", () => {
  const items = [makeShare({ id: "low", relevanceScore: 10 }), makeShare({ id: "high", relevanceScore: 90 })];
  assert.deepEqual(sortLiveShares(items, "recommended").map((item) => item.id), ["high", "low"]);
});

test("sortLiveShares breaks ties by startedAt desc then id desc", () => {
  const items = [
    makeShare({ id: "a", relevanceScore: 10, startedAt: "2026-07-29T00:00:00.000Z" }),
    makeShare({ id: "b", relevanceScore: 10, startedAt: "2026-07-29T00:05:00.000Z" }),
    makeShare({ id: "c", relevanceScore: 10, startedAt: "2026-07-29T00:05:00.000Z" }),
  ];
  assert.deepEqual(sortLiveShares(items, "recommended").map((item) => item.id), ["c", "b", "a"]);
});

test("selectFeaturedLiveShare returns the item with the highest relevanceScore", () => {
  const items = [makeShare({ id: "a", relevanceScore: 5 }), makeShare({ id: "b", relevanceScore: 40 }), makeShare({ id: "c", relevanceScore: 15 })];
  assert.equal(selectFeaturedLiveShare(items)?.id, "b");
});

test("selectFeaturedLiveShare returns null for an empty list", () => {
  assert.equal(selectFeaturedLiveShare([]), null);
});
