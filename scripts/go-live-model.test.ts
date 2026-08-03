import assert from "node:assert/strict";
import { test } from "node:test";
import {
  allowedVisibilityModes,
  canAdvanceFromStep,
  createEmptyGoLiveDraft,
  evaluateGoLivePreflight,
  nextGoLiveStep,
  parseGoLiveRouteParams,
  preflightBlocksStart,
  previousGoLiveStep,
  reduceGoLiveStartPhase,
  sanitizeGoLiveText,
  validateGoLiveTitle,
  visibilitySummary,
} from "../src/components/live/goLiveModel.ts";

test("parseGoLiveRouteParams accepts only uuid community/channel/schedule query values", () => {
  assert.deepEqual(parseGoLiveRouteParams("community=nope&channel=also-no"), {
    communityId: null,
    channelId: null,
    scheduleEventId: null,
  });
  assert.deepEqual(
    parseGoLiveRouteParams("community=550e8400-e29b-41d4-a716-446655440000&channel=550e8400-e29b-41d4-a716-446655440001&schedule=550e8400-e29b-41d4-a716-446655440002"),
    {
      communityId: "550e8400-e29b-41d4-a716-446655440000",
      channelId: "550e8400-e29b-41d4-a716-446655440001",
      scheduleEventId: "550e8400-e29b-41d4-a716-446655440002",
    },
  );
});

test("title validation strips control characters and requires content", () => {
  assert.equal(validateGoLiveTitle("").ok, false);
  assert.equal(validateGoLiveTitle("   ").ok, false);
  const ok = validateGoLiveTitle("Hello\u0000 world");
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.value, "Hello world");
  assert.equal(sanitizeGoLiveText("a".repeat(200), 160).length, 160);
});

test("visibility restrictions respect private channel and non-public community", () => {
  assert.deepEqual(
    allowedVisibilityModes({ communityVisibility: "private", channelPrivate: true }),
    ["channel_members"],
  );
  assert.deepEqual(
    allowedVisibilityModes({ communityVisibility: "public", channelPrivate: false }),
    ["channel_members", "community_members", "public_discovery"],
  );
  assert.match(
    visibilitySummary({
      visibilityMode: "channel_members",
      communityName: "Ops",
      channelName: "stage",
      channelPrivate: true,
      communityVisibility: "private",
    }),
    /Only members who can access #stage/,
  );
});

test("step navigation and gates", () => {
  assert.equal(nextGoLiveStep("context"), "source");
  assert.equal(previousGoLiveStep("source"), "context");
  assert.equal(canAdvanceFromStep("context", createEmptyGoLiveDraft()).ok, false);
  const ready = createEmptyGoLiveDraft({
    communityId: "550e8400-e29b-41d4-a716-446655440000",
    channelId: "550e8400-e29b-41d4-a716-446655440001",
    canPublishScreen: true,
    sourceId: "screen:1",
    title: "Demo",
    policyAccepted: true,
    visibilityMode: "channel_members",
  });
  assert.equal(canAdvanceFromStep("context", ready).ok, true);
  assert.equal(canAdvanceFromStep("source", ready).ok, true);
  assert.equal(canAdvanceFromStep("details", ready).ok, true);
  assert.equal(canAdvanceFromStep("visibility", ready).ok, true);
});

test("start state machine and preflight reducer", () => {
  let phase = reduceGoLiveStartPhase("idle", { type: "start" });
  assert.equal(phase, "preparing");
  phase = reduceGoLiveStartPhase(phase, { type: "authorized" });
  assert.equal(phase, "authorizing");
  phase = reduceGoLiveStartPhase(phase, { type: "connected" });
  assert.equal(phase, "connecting");
  phase = reduceGoLiveStartPhase(phase, { type: "published" });
  assert.equal(phase, "publishing");
  phase = reduceGoLiveStartPhase(phase, { type: "confirmed" });
  assert.equal(phase, "live");

  const checks = evaluateGoLivePreflight({
    authenticated: true,
    canPublishScreen: true,
    publisherBroadcastAllowed: true,
    hasCommunityChannel: true,
    hasActiveSource: true,
    sourceEnded: false,
    microphoneDesired: false,
    microphoneReady: true,
    networkOnline: true,
    livekitReachable: true,
    conflict: false,
  });
  assert.equal(preflightBlocksStart(checks), false);
  const failed = evaluateGoLivePreflight({
    authenticated: false,
    canPublishScreen: false,
    publisherBroadcastAllowed: false,
    hasCommunityChannel: false,
    hasActiveSource: false,
    sourceEnded: true,
    microphoneDesired: true,
    microphoneReady: false,
    networkOnline: false,
    livekitReachable: false,
    conflict: true,
  });
  assert.equal(preflightBlocksStart(failed), true);
});
