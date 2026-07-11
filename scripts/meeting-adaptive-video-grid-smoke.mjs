import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const planner = read("src/types/meetingVideoGrid.ts");
const grid = read("src/components/meeting/MeetingVideoGrid.tsx");
const css = read("src/components/meeting/MeetingVideoGrid.css");
const voice = read("src/services/voiceService.ts");
const service = read("src/services/meeting/meetingService.ts");

for (const count of ["count <= 1", "count === 2", "count <= 4", "count <= 6", "count <= 9"]) assert.ok(planner.includes(count), `deterministic layout rule missing: ${count}`);
assert.ok(planner.includes("MEETING_VIDEO_PAGE_SIZE = 12") && planner.includes("pageCount"), "12-person pagination contract missing");
assert.ok(grid.includes("cameraStream") && grid.includes("Camera off") && grid.includes("Connecting camera"), "live camera/avatar fallback missing");
assert.ok(css.includes("aspect-ratio:16/9") && css.includes("data-layout=twelve") && css.includes("overflow:auto"), "aspect ratio or overflow layout missing");
for (const marker of ["setSubscribed", "setVideoQuality", "VideoQuality.HIGH", "VideoQuality.MEDIUM", "VideoQuality.LOW", "adaptiveStream: true", "dynacast: true"]) assert.ok(voice.includes(marker), `bandwidth strategy missing ${marker}`);
assert.ok(service.includes("setVideoSubscriptions") && grid.includes("meetingService.setVideoSubscriptions"), "UI must use meeting service subscription boundary");
assert.ok(!grid.includes("livekit-client"), "grid must not call LiveKit directly");
console.log("PASS adaptive meeting video grid");
