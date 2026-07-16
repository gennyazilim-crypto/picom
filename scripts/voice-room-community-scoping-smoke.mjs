import fs from "node:fs";

// Regression guard: communities are independent. A voice session in one community must NEVER
// surface in another community's channels. Root causes fixed: (1) the active room was matched
// by channel NAME (default channel names repeat across communities) or bare channel-id suffix;
// (2) participant names were fabricated from the community's online members, showing users
// "in voice" in rooms they never joined.

const service = fs.readFileSync("src/services/activeVoiceRoomDiscoveryService.ts", "utf8");
const roomView = fs.readFileSync("src/components/VoiceRoomView.tsx", "utf8");

const checks = [
  [roomView.includes("snapshot.roomContext?.communityId === community.id && snapshot.roomContext?.channelId === channel.id"),
    "VoiceRoomView must scope connected/joining to THIS community's channel (sessionHere)"],
  [roomView.includes("const connected = sessionHere &&"),
    "VoiceRoomView 'connected' must require sessionHere — never bare snapshot.status"],
  [service.includes("voiceSnapshot.roomContext?.communityId === community.id"),
    "local-session match must require the community to match (not just the channel)"],
  [service.includes(":${communityId.toLowerCase()}:"),
    "roomName match must require the owning community id in the scoped room name"],
  [!service.includes("=== channelName.toLowerCase()"),
    "room matching by channel NAME is forbidden (names repeat across communities)"],
  [!service.includes("community.members.filter"),
    "participant names must never be fabricated from online community members"],
];

const failed = checks.filter(([ok]) => !ok);
if (failed.length) {
  for (const [, label] of failed) console.error(`FAIL: ${label}`);
  process.exit(1);
}
for (const [, label] of checks) console.log(`PASS: ${label}`);
console.log("Voice room community scoping smoke passed.");
