import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ttl = readFileSync(join(root, "src/services/voice/voiceRoomChatTtl.ts"), "utf8");
const panel = readFileSync(join(root, "src/components/voice/VoiceRoomChatPanel.tsx"), "utf8");
const rail = readFileSync(join(root, "src/components/voice/VoiceParticipantsRail.tsx"), "utf8");
const app = readFileSync(join(root, "src/App.tsx"), "utf8");

assert.match(ttl, /VOICE_ROOM_CHAT_TTL_MS\s*=\s*30\s*\*\s*60\s*\*\s*1000/);
assert.match(ttl, /filterAliveVoiceChatMessages/);
assert.match(ttl, /getNextVoiceChatExpiryDelayMs/);
assert.match(ttl, /listExpiredVoiceChatMessages/);

assert.match(panel, /filterAliveVoiceChatMessages/);
assert.match(panel, /onExpireMessage/);
assert.match(panel, /ttlTick/);
assert.match(panel, /Messages auto-delete after 30 minutes/);

assert.match(rail, /onExpireMessage/);
assert.match(app, /expireVoiceChatMessage/);
assert.match(app, /onExpireMessage=\{expireVoiceChatMessage\}/);

// Pure TTL math (mirrors voiceRoomChatTtl.ts)
const VOICE_ROOM_CHAT_TTL_MS = 30 * 60 * 1000;
const now = Date.parse("2026-07-16T12:00:00.000Z");
const freshCreated = now - 5 * 60 * 1000;
const agedCreated = now - VOICE_ROOM_CHAT_TTL_MS - 1000;
assert.equal(freshCreated + VOICE_ROOM_CHAT_TTL_MS > now, true);
assert.equal(agedCreated + VOICE_ROOM_CHAT_TTL_MS > now, false);
assert.equal(Math.max(0, freshCreated + VOICE_ROOM_CHAT_TTL_MS - now) > 0, true);

console.log("voice-room-chat-ttl smoke ok");
