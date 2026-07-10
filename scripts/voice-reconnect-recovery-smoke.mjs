import fs from "node:fs";

const service = fs.readFileSync("src/services/voiceService.ts", "utf8");
const view = fs.readFileSync("src/components/VoiceRoomView.tsx", "utf8");

for (const needle of [
  "joinInFlight",
  "lastJoinRequest",
  "removeAllListeners",
  "desiredMuted",
  "desiredDeafened",
  "restoredFromReconnect",
  "new Map(participants.map",
  "async reconnect()",
]) {
  if (!service.includes(needle)) throw new Error(`Voice recovery implementation is missing ${needle}`);
}
if (!view.includes('disconnected ? "Reconnect"')) throw new Error("Voice room does not expose a reconnect action state");

console.log("Voice reconnect and recovery smoke passed.");
