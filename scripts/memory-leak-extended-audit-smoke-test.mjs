import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const app = read("src/App.tsx");
const fileService = read("src/services/fileService.ts");
const composer = read("src/components/MessageComposer.tsx");
const messageRealtime = read("src/hooks/useSupabaseMessageRealtime.ts");
const typingRealtime = read("src/hooks/useSupabaseTypingBroadcast.ts");
const presenceRealtime = read("src/hooks/useSupabasePresenceChannel.ts");
const dmRealtime = read("src/hooks/useDirectMessageRealtime.ts");
const voice = read("src/services/voiceService.ts");
const voiceDevices = read("src/services/voiceDeviceService.ts");
const network = read("src/services/networkStatusService.ts");
const resume = read("src/services/sleepWakeResumeService.ts");
const apiClient = read("src/services/apiClient.ts");
const docs = read("docs/memory-leak-extended-audit.md");

assert(fileService.includes("URL.createObjectURL") && fileService.includes("URL.revokeObjectURL"), "Local attachment object URL lifecycle is incomplete");
for (const marker of ["previewsRef.current.forEach", "fileService.revoke(preview)", "return () =>", "setPreviews([])"])
  assert(composer.includes(marker), `MessageComposer preview cleanup is missing ${marker}`);

for (const [label, source, markers] of [
  ["message realtime", messageRealtime, ["subscriptionGenerationRef", "canceled = true", "client.removeChannel(channel)"]],
  ["typing realtime", typingRealtime, ["window.clearInterval(cleanupTimer)", "client.removeChannel(channel)", "latestTypingEventAtRef.current = {}"]],
  ["presence realtime", presenceRealtime, ["window.clearTimeout", "window.clearInterval", "channel.untrack()", "client.removeChannel(channel)"]],
  ["DM realtime", dmRealtime, ["canceled = true", "client.removeChannel(channel)", "eventDeduperRef.current.clear()"]],
]) for (const marker of markers) assert(source.includes(marker), `${label} cleanup is missing ${marker}`);

for (const marker of ["stopLocalTracks(activeRoom)", "activeRoom.removeAllListeners()", "if (room === activeRoom) room = null", "unpublishTrack(track, true)", "track.stop()"])
  assert(voice.includes(marker), `LiveKit/screen-share cleanup is missing ${marker}`);

for (const marker of ["messageHighlightTimerRef", "window.clearTimeout(messageHighlightTimerRef.current)", "messageHighlightTimerRef.current = null"])
  assert(app.includes(marker), `Message highlight timer cleanup is missing ${marker}`);

assert(voiceDevices.includes('removeEventListener("devicechange"') && voiceDevices.includes("listeners.size === 0"), "Voice device listener is not removed after the final subscriber");
for (const marker of ['removeEventListener("online"', 'removeEventListener("offline"', "clearInterval(healthTimer)"])
  assert(network.includes(marker), `Network lifecycle cleanup is missing ${marker}`);
for (const marker of ["sleepWakeResumeService.stop()", "document.removeEventListener", "window.removeEventListener", "window.clearTimeout(pendingTimer)"])
  assert(resume.includes(marker), `Sleep/wake cleanup is missing ${marker}`);
assert(apiClient.includes('removeEventListener("abort"') && apiClient.includes("window.clearTimeout(timeout)"), "API abort/timeout cleanup is incomplete");

for (const marker of ["Object URLs", "Realtime", "LiveKit", "screen share", "timers", "keyboard listeners", "heap snapshots pending"])
  assert(docs.toLowerCase().includes(marker.toLowerCase()), `Memory audit documentation is missing ${marker}`);

console.log("Extended memory leak structural audit passed; packaged long-run heap evidence remains manual.");
