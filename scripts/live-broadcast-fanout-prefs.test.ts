import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildLiveStartIdempotencyKey,
  normalizeLiveStartPreferenceMode,
  resolveLiveStartPreferenceMode,
  shouldDeliverLiveStartNotification,
} from "../src/components/live/liveBroadcastFanoutPolicy.ts";

describe("liveBroadcastFanoutPolicy", () => {
  const base = {
    preferenceMode: "all_live" as const,
    followsBroadcaster: true,
    blockedEitherWay: false,
    canViewSession: true,
    isCommunityMember: true,
    hasLinkedOrMatchingSchedule: false,
    connectionNotificationsEnabled: true,
    recipientBanned: false,
  };

  it("defaults missing preference to all_live", () => {
    assert.equal(resolveLiveStartPreferenceMode(null), "all_live");
    assert.equal(normalizeLiveStartPreferenceMode("all"), "all_live");
    assert.equal(normalizeLiveStartPreferenceMode("community_member_only"), "important_only");
    assert.equal(shouldDeliverLiveStartNotification({ ...base, preferenceMode: null }), true);
  });

  it("honors off / scheduled_only / important_only", () => {
    assert.equal(shouldDeliverLiveStartNotification({ ...base, preferenceMode: "off" }), false);
    assert.equal(
      shouldDeliverLiveStartNotification({
        ...base,
        preferenceMode: "scheduled_only",
        hasLinkedOrMatchingSchedule: false,
      }),
      false,
    );
    assert.equal(
      shouldDeliverLiveStartNotification({
        ...base,
        preferenceMode: "scheduled_only",
        hasLinkedOrMatchingSchedule: true,
      }),
      true,
    );
    assert.equal(
      shouldDeliverLiveStartNotification({
        ...base,
        preferenceMode: "important_only",
        isCommunityMember: false,
      }),
      false,
    );
  });

  it("blocks unfollow, block, ban, visibility, and global prefs", () => {
    assert.equal(shouldDeliverLiveStartNotification({ ...base, followsBroadcaster: false }), false);
    assert.equal(shouldDeliverLiveStartNotification({ ...base, blockedEitherWay: true }), false);
    assert.equal(shouldDeliverLiveStartNotification({ ...base, recipientBanned: true }), false);
    assert.equal(shouldDeliverLiveStartNotification({ ...base, canViewSession: false }), false);
    assert.equal(shouldDeliverLiveStartNotification({ ...base, connectionNotificationsEnabled: false }), false);
  });

  it("builds canonical idempotency keys", () => {
    assert.equal(
      buildLiveStartIdempotencyKey("11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"),
      "live-start:11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222:v1",
    );
  });
});
