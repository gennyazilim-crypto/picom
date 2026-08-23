/**
 * Ensures DM + friend presence realtime channels use unique topics
 * (prevents companion crash: cannot add postgres_changes after subscribe()).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const DM = readFileSync(join(ROOT, "src/services/directMessages/directRealtimeService.ts"), "utf8");
const PRESENCE = readFileSync(join(ROOT, "src/services/friends/friendPresenceService.ts"), "utf8");
const HOME = readFileSync(join(ROOT, "src/features/companion/companionDataService.ts"), "utf8");

test("DM list and active channels use uniqueRealtimeChannelName", () => {
  assert.match(DM, /function uniqueRealtimeChannelName\(/);
  assert.match(DM, /uniqueRealtimeChannelName\(realtimeChannelNames\.directList\(/);
  assert.match(DM, /uniqueRealtimeChannelName\(realtimeChannelNames\.directActive\(/);
  assert.doesNotMatch(DM, /client\.channel\(realtimeChannelNames\.directList\(/);
  assert.doesNotMatch(DM, /client\.channel\(realtimeChannelNames\.directActive\(/);
});

test("Friend presence channels use uniquePresenceChannelName", () => {
  assert.match(PRESENCE, /function uniquePresenceChannelName\(/);
  assert.match(PRESENCE, /uniquePresenceChannelName\(/);
  assert.match(PRESENCE, /auth\.client\.channel\(channelName\)/);
});

test("Companion subscribeHome isolates realtime subscribe failures", () => {
  assert.match(HOME, /Companion DM list realtime could not start/);
  assert.match(HOME, /Companion friend realtime could not start/);
});
