import assert from "node:assert/strict";
import { test } from "node:test";
import type { LiveScreenShareSummary } from "../src/types/liveScreenShare";
import type { VoiceScreenShare } from "../src/services/voiceService.ts";
import {
  categoryLabel,
  formatWatchDuration,
  formatWatchViewerCount,
  isEndedLiveStatus,
  isWatchableLiveStatus,
  mapWatchLoadErrorMessage,
  parseLiveSessionIdParam,
  resolveWatchPlayerPhase,
  selectBroadcasterScreenShare,
} from "../src/components/live/liveWatchModel.ts";

function share(partial: Partial<LiveScreenShareSummary> & Pick<LiveScreenShareSummary, "id">): LiveScreenShareSummary {
  return {
    livekitRoomName: "room",
    communityId: "c1",
    channelId: "ch1",
    broadcasterUserId: "broadcaster-1",
    title: "Stream",
    category: "chat",
    applicationName: "",
    status: "live",
    startedAt: new Date(Date.now() - 125_000).toISOString(),
    endedAt: null,
    viewerCount: 12,
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

test("parseLiveSessionIdParam accepts only uuid session ids", () => {
  assert.equal(parseLiveSessionIdParam("not-a-uuid"), null);
  assert.equal(parseLiveSessionIdParam(""), null);
  assert.equal(parseLiveSessionIdParam(" room name "), null);
  assert.equal(
    parseLiveSessionIdParam("550e8400-e29b-41d4-a716-446655440000"),
    "550e8400-e29b-41d4-a716-446655440000",
  );
});

test("watchable and ended status helpers", () => {
  assert.equal(isWatchableLiveStatus("live"), true);
  assert.equal(isWatchableLiveStatus("reconnecting"), true);
  assert.equal(isWatchableLiveStatus("ended"), false);
  assert.equal(isEndedLiveStatus("ended"), true);
  assert.equal(isEndedLiveStatus("terminated"), true);
  assert.equal(isEndedLiveStatus("live"), false);
});

test("resolveWatchPlayerPhase maps permission, reconnecting, ended, and track states", () => {
  assert.equal(
    resolveWatchPlayerPhase({
      loadErrorCode: "LIVE_FORBIDDEN",
      session: null,
      voiceStatus: "idle",
      hasTrack: false,
      sessionEndedLocally: false,
    }),
    "permission_denied",
  );
  assert.equal(
    resolveWatchPlayerPhase({
      loadErrorCode: null,
      session: share({ id: "1", status: "reconnecting" }),
      voiceStatus: "connected",
      hasTrack: true,
      sessionEndedLocally: false,
    }),
    "reconnecting",
  );
  assert.equal(
    resolveWatchPlayerPhase({
      loadErrorCode: null,
      session: share({ id: "1", status: "ended" }),
      voiceStatus: "connected",
      hasTrack: false,
      sessionEndedLocally: false,
    }),
    "ended",
  );
  assert.equal(
    resolveWatchPlayerPhase({
      loadErrorCode: null,
      session: share({ id: "1" }),
      voiceStatus: "connected",
      hasTrack: false,
      sessionEndedLocally: false,
    }),
    "track_unavailable",
  );
  assert.equal(
    resolveWatchPlayerPhase({
      loadErrorCode: null,
      session: share({ id: "1" }),
      voiceStatus: "connected",
      hasTrack: true,
      sessionEndedLocally: false,
    }),
    "live",
  );
});

test("selectBroadcasterScreenShare prefers broadcaster identity and ignores local", () => {
  const stream = {} as MediaStream;
  const shares: VoiceScreenShare[] = [
    { id: "local", participantIdentity: "me", participantName: "Me", isLocal: true, stream },
    { id: "other", participantIdentity: "other", participantName: "Other", isLocal: false, stream },
    { id: "host", participantIdentity: "broadcaster-1", participantName: "Host", isLocal: false, stream },
  ];
  assert.equal(selectBroadcasterScreenShare(shares, "broadcaster-1")?.id, "host");
  assert.equal(selectBroadcasterScreenShare(shares.slice(0, 2), "broadcaster-1"), null);
  assert.equal(selectBroadcasterScreenShare([], "broadcaster-1"), null);
});

test("viewer count formatter hides invalid values", () => {
  assert.equal(formatWatchViewerCount(null), null);
  assert.equal(formatWatchViewerCount(-1), null);
  assert.equal(formatWatchViewerCount(12), "12");
  assert.equal(formatWatchViewerCount(1500), "1.5K");
});

test("duration, category, and error mapping helpers", () => {
  assert.match(formatWatchDuration(share({ id: "1" }).startedAt), /^\d+:\d{2}$/);
  assert.equal(categoryLabel("education"), "Education");
  assert.equal(mapWatchLoadErrorMessage("LIVE_FORBIDDEN", "x"), "You do not have permission to watch this stream.");
  assert.equal(mapWatchLoadErrorMessage("LIVE_NOT_FOUND", "x"), "This live stream is unavailable.");
});
