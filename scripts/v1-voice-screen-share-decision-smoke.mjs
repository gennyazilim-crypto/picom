import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const scope = read("src/config/v1ReleaseScope.ts");
const app = read("src/App.tsx");
const sidebar = read("src/components/CommunitySidebar.tsx");
const rail = read("src/components/FeedCompanionRail.tsx");
const settings = read("src/services/settingsService.ts");
const communitySettings = read("src/components/community/CommunitySettingsEditor.tsx");
const firstLaunch = read("src/components/firstLaunch/FirstLaunchSetup.tsx");
const help = read("src/components/HelpCenterView.tsx");
const routes = read("src/services/navigation/authenticatedRouteService.ts");
const config = read("supabase/functions/client-config/index.ts");
const manifest = JSON.parse(read("supabase/functions/release-manifest.json"));
const voiceRenderer = read("src/services/voiceService.ts");
const decision = read("docs/v1-voice-screen-share-decision.md");

for (const feature of ["voiceRooms", "screenShare"]) assert.ok(new RegExp(`${feature}: hidden\\(`).test(scope), `${feature} must be HIDDEN_FROM_V1`);
assert.ok(app.includes("isV1ChannelTypeEnabled") && app.includes(".filter((channel) => isV1ChannelTypeEnabled(channel.type))"), "active/deep-linked channels must use the V1 type gate");
assert.ok(sidebar.includes("isV1ChannelTypeEnabled(channel.type)"), "voice channels must be absent from CommunitySidebar");
assert.ok(rail.includes('!isV1FeatureEnabled("voiceRooms")') && rail.includes('isV1FeatureEnabled("voiceRooms") ? <ActiveVoiceRoomsSection'), "Connected Voice and room discovery must be hidden");
assert.ok(settings.includes('section === "Voice & Video"') && settings.includes('isV1FeatureEnabled("voiceRooms") || isV1FeatureEnabled("screenShare")'), "Voice settings must consume the V1 gate");
assert.ok(communitySettings.includes('isV1FeatureEnabled("voiceRooms") ? <label'), "Community Admin voice control must consume the V1 gate");
assert.doesNotMatch(firstLaunch, /id: "voice"|copy\.permissions\.microphone|copy\.permissions\.screen|copy\.voice\./, "First Launch must not advertise Voice or Screen Share");
assert.ok(!help.includes("upload, voice, or package"), "V1 Help must not promise Voice support");
assert.ok(routes.includes("isV1AuthenticatedRouteEnabled") && routes.includes('voice: "voiceRooms"'), "authenticated deep links must reject hidden Voice");
assert.ok(config.includes("enableVoiceRooms: false") && config.includes("enableScreenShare: false"), "public client config must keep both capabilities off");
for (const name of ["livekit-token", "livekit-moderation", "livekit-webhook"]) {
  const item = manifest.excluded.find((entry) => entry.name === name);
  assert.equal(item?.classification, "hidden_v1", `${name} must not deploy in V1`);
}
assert.ok(!voiceRenderer.includes("LIVEKIT_API_SECRET") && !voiceRenderer.includes("LIVEKIT_API_KEY"), "provider credentials must never reach renderer services");
assert.ok(decision.includes("Decision: **HIDDEN_FROM_V1**") && decision.includes("BLOCKED_HOSTED") && decision.includes("BLOCKED_NATIVE"), "decision must be binary and evidence-truthful");
console.log("V1 Voice and Screen Share decision contract passed: HIDDEN_FROM_V1.");
