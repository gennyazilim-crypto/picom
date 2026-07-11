import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const component = read("src/components/meeting/MeetingScreenShareFocus.tsx");
const workspace = read("src/components/meeting/MeetingWorkspace.tsx");
const stage = read("src/components/meeting/MeetingStage.tsx");
const voice = read("src/services/voiceService.ts");
const policy = read("src/services/livekit/screenShareSubscriptionPolicy.ts");
const diagnosticsRegistry = read("src/services/voiceDiagnosticsRegistry.ts");
const service = read("src/services/meeting/meetingService.ts");

for (const scale of ['"fit"', '"fill"', '"actual"']) assert.ok(component.includes(scale), `share focus missing ${scale} scale`);
for (const copy of ["Actual Size", "Return to Grid", "Speaker view", "Sharing now"]) assert.ok(component.includes(copy), `share focus missing ${copy}`);
assert.ok(component.includes("ShareVideo") && component.includes("CompactParticipant") && component.includes("sourceLabel"), "share media/context missing");
assert.ok(workspace.includes("autoShareLayoutRef") && workspace.includes("previousLayoutRef") && workspace.includes("shareLayoutOverride"), "automatic/explicit layout policy missing");
assert.ok(stage.includes('snapshot.layout === "screen_share"') && stage.includes("MeetingScreenShareFocus"), "screen-share route missing");
for (const marker of ["applyFocusedScreenShareSubscription", "TrackMuted", "TrackUnmuted", "TrackSubscriptionFailed", "setFocusedScreenShare"]) assert.ok(voice.includes(marker), `provider share recovery missing ${marker}`);
assert.ok(policy.includes("applySingleScreenShareSubscription") && policy.includes("setSubscribed") && policy.includes("publications[0]"), "one-active-share policy missing");
assert.ok(diagnosticsRegistry.includes("idleSummary") && diagnosticsRegistry.includes("setProvider"), "lazy voice diagnostics registry missing");
assert.ok(service.includes("setFocusedScreenShare") && !component.includes("livekit-client"), "share UI must use meeting service boundary");
console.log("PASS meeting screen share focus layout");
