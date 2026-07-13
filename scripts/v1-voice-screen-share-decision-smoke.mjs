import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const scope = read("src/config/v1ReleaseScope.ts");
const app = read("src/App.tsx");
const sidebar = read("src/components/CommunitySidebar.tsx");
const rail = read("src/components/FeedCompanionRail.tsx");
const settings = read("src/services/settingsService.ts");
const routes = read("src/services/navigation/authenticatedRouteService.ts");
const config = read("supabase/functions/client-config/index.ts");
const manifest = JSON.parse(read("supabase/functions/release-manifest.json"));
const authorization = read("supabase/migrations/20260712211000_voice_screen_v1_active_member_access.sql");
const voiceRenderer = read("src/services/voiceService.ts");
const amendment = read("docs/v1-voice-screen-scope-amendment.md");

for (const feature of ["voiceRooms", "screenShare"]) assert.match(scope, new RegExp(`${feature}: inV1\\(`), `${feature} must remain IN_V1`);
assert.ok(app.includes("isV1ChannelTypeEnabled") && app.includes("<VoiceRoomView"), "Voice channels and VoiceRoomView must remain wired");
assert.ok(sidebar.includes("isV1ChannelTypeEnabled(channel.type)"), "CommunitySidebar must consume the enabled V1 scope registry");
assert.ok(rail.includes('isV1FeatureEnabled("voiceRooms") ? <ActiveVoiceRoomsSection'), "Connected Voice discovery must remain reachable");
assert.ok(settings.includes('isV1FeatureEnabled("voiceRooms") || isV1FeatureEnabled("screenShare")'), "Voice settings must consume V1 scope");
assert.ok(routes.includes('voice: "voiceRooms"'), "authenticated Voice routes must use the V1 registry");
assert.ok(config.includes("enableVoiceRooms: true") && config.includes("enableScreenShare: true"), "public client config must advertise mandatory V1 features");
for (const name of ["livekit-token", "livekit-moderation"]) assert.ok(manifest.releaseAuthenticated.some((entry) => entry.name === name), `${name} must be release-authenticated`);
for (const marker of ["community_members", "community_bans", "community_member_timeouts", "viewPrivateChannels", "true,true"]) assert.ok(authorization.includes(marker), `active-member authorization missing ${marker}`);
for (const forbidden of ["'joinVoice'", "'speakInVoice'", "'shareScreen'"]) assert.ok(!authorization.includes(forbidden), `ordinary media access must not require ${forbidden}`);
assert.ok(!voiceRenderer.includes("LIVEKIT_API_SECRET") && !voiceRenderer.includes("LIVEKIT_API_KEY"), "provider credentials must never reach renderer services");
assert.ok(amendment.includes("mandatory `IN_V1`") && amendment.includes("release remains No-Go"), "scope/readiness amendment is incomplete");
console.log("V1 Voice and Screen Share scope contract passed: mandatory IN_V1 with evidence-gated release readiness.");
