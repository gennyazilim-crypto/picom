import assert from "node:assert/strict";
import { test } from "node:test";
import type { LiveScreenShareSummary } from "../src/types/liveScreenShare";
import {
  buildCategoryBuckets,
  isJustStarted,
  partitionLiveDiscovery,
} from "../src/components/live/liveDiscoveryModel.ts";

function share(partial: Partial<LiveScreenShareSummary> & Pick<LiveScreenShareSummary, "id">): LiveScreenShareSummary {
  return {
    livekitRoomName: "room",
    communityId: "c1",
    channelId: "ch1",
    broadcasterUserId: "u1",
    title: "Stream",
    category: "chat",
    applicationName: "",
    status: "live",
    startedAt: new Date().toISOString(),
    endedAt: null,
    viewerCount: 10,
    participantCount: 2,
    previewUpdatedAt: null,
    communityName: "Community",
    channelName: "general",
    broadcasterDisplayName: "Host",
    broadcasterUsername: "host",
    friendViewerIds: [],
    relevanceScore: 40,
    ...partial,
  };
}

test("buildCategoryBuckets counts only live/reconnecting shares", () => {
  const buckets = buildCategoryBuckets([
    share({ id: "1", category: "game" }),
    share({ id: "2", category: "game", status: "ended" }),
    share({ id: "3", category: "chat" }),
  ]);
  assert.equal(buckets.find((item) => item.id === "game")?.liveCount, 1);
  assert.equal(buckets.find((item) => item.id === "chat")?.liveCount, 1);
});

test("partitionLiveDiscovery splits friends, rising, and just started without inventing metrics", () => {
  const now = Date.parse("2026-07-30T20:00:00.000Z");
  const just = share({
    id: "just",
    startedAt: new Date(now - 2 * 60_000).toISOString(),
    viewerCount: 3,
    relevanceScore: 10,
  });
  const rising = share({
    id: "rise",
    startedAt: new Date(now - 60 * 60_000).toISOString(),
    viewerCount: 120,
    relevanceScore: 80,
  });
  const friends = share({
    id: "friend",
    startedAt: new Date(now - 30 * 60_000).toISOString(),
    friendViewerIds: ["f1"],
    viewerCount: 20,
    relevanceScore: 50,
  });

  assert.equal(isJustStarted(just, now), true);
  assert.equal(isJustStarted(rising, now), false);

  const parts = partitionLiveDiscovery([just, rising, friends], {
    memberItems: [rising],
    now,
  });

  assert.equal(parts.featured?.id, "rise");
  assert.equal(parts.justStarted[0]?.id, "just");
  assert.ok(parts.risingFast.some((item) => item.id === "rise"));
  assert.ok(!parts.risingFast.some((item) => item.id === "just"));
  assert.equal(parts.friendsWatching[0]?.id, "friend");
  assert.equal(parts.memberLive[0]?.id, "rise");
});
