/**
 * Static smoke for TASK30 recording/replay/clip schema + fail-closed flags.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(path.join(root, rel), "utf8");

const files = [
  "supabase/migrations/20260808270000_publisher_recording_replay_core.sql",
  "supabase/migrations/20260808280000_publisher_media_security.sql",
  "supabase/migrations/20260808290000_publisher_clip_processing.sql",
];
for (const file of files) assert.ok(existsSync(path.join(root, file)), file);

const core = read(files[0]);
const security = read(files[1]);
const clips = read(files[2]);

assert.match(core, /publisher_recordings/);
assert.match(core, /publisher_replays/);
assert.match(core, /recording_enabled/);
assert.match(core, /RECORDING_CAPACITY_EXCEEDED/);
assert.match(core, /REQUESTED.*STARTING.*RECORDING/s);
assert.doesNotMatch(core, /for insert to authenticated/);

assert.match(security, /publisher-stream-recordings/);
assert.match(security, /create_publisher_replay_playback_url/);
assert.match(security, /service_apply_publisher_egress_event/);
assert.match(security, /root_moderate_publisher_replay/);
assert.match(security, /dashboard\.read does NOT grant/);

assert.match(clips, /duration_ms <= 60000/);
assert.match(clips, /request_publisher_clip/);
assert.match(clips, /claim_publisher_media_jobs/);
assert.match(clips, /for update skip locked/i);

const flags = read("src/services/featureFlagService.ts");
assert.match(flags, /enableLiveRecording/);
assert.match(flags, /enableLiveReplays/);
assert.match(flags, /enableLiveClips/);
assert.match(flags, /enableLiveRecording:\s*appConfig\.environment !== "production"/);

const webhook = read("supabase/functions/livekit-webhook/index.ts");
assert.match(webhook, /publisherEgressEvents/);
assert.match(webhook, /service_apply_publisher_egress_event/);

const edge = read("supabase/functions/publisher-recording/index.ts");
assert.match(edge, /EGRESS_NOT_DEPLOYED|STORAGE_CREDENTIAL_MISSING/);
assert.match(edge, /PICOM_LIVEKIT_EGRESS_ENABLED/);
assert.doesNotMatch(edge, /LIVEKIT_API_SECRET.*(return|jsonResponse)/);

const ui = read("src/components/publisher/PublisherReplayArchivePanel.tsx");
assert.match(ui, /publisherRecordingService/);
assert.doesNotMatch(ui, /localStorage/);
assert.doesNotMatch(ui, /Math\.random/);

// Clip boundary fixtures (mirror server rules)
function validClip(start, end, replayDuration = 120000) {
  if (start < 0 || end <= start) return false;
  if (end - start > 60000) return false;
  if (end > replayDuration) return false;
  return true;
}
assert.equal(validClip(0, 10000), true);
assert.equal(validClip(0, 60000), true);
assert.equal(validClip(0, 60001), false);
assert.equal(validClip(-1, 1000), false);
assert.equal(validClip(10, 10), false);
assert.equal(validClip(50, 40), false);
assert.equal(validClip(0, 1000, 500), false);

console.log("publisher-recording-smoke: PASS");
