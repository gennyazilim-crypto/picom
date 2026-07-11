import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const queue = readFileSync("src/components/meeting/MeetingWaitingRoomHostQueue.tsx", "utf8");
const workspace = readFileSync("src/components/meeting/MeetingWorkspace.tsx", "utf8");
const surface = readFileSync("src/components/meeting/MeetingWorkspaceSurfaces.tsx", "utf8");
const service = readFileSync("src/services/meeting/meetingService.ts", "utf8");
const realtime = readFileSync("src/services/meeting/meetingWaitingRoomRealtimeService.ts", "utf8");

for (const marker of ["meetingWaitingRoomRealtimeService.subscribe", "meetingWaitingRoomService.resolveAll", "role=\"alertdialog\"", "busyKeysRef", "Admit all", "Deny all", "requestedAt", "inviteId"]) assert.ok(queue.includes(marker), `missing host queue marker: ${marker}`);
for (const marker of ["admissionOnly", "is-admission-only", "admissionOnly?null:<MeetingControlDock", "admissionOnly?null:snapshot.phase"]) assert.ok(workspace.includes(marker), `missing waiting privacy marker: ${marker}`);
for (const state of ["waiting", "admitted", "denied", "expired", "cancelled", "locked", "ended"]) assert.ok(surface.includes(`${state}:`), `missing waiting state: ${state}`);
assert.ok(service.includes("cancelWaitingRequest"), "meeting service must expose authoritative cancellation");
assert.ok(service.includes("meetingWaitingRoomService.cancel"), "cancellation must use waiting-room service");
assert.ok(realtime.includes('filter: `room_id=eq.${roomId}`'), "waiting realtime must remain room-scoped");

console.log("Meeting waiting-room UI Full MVP smoke passed.");
