import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const assert = (condition, label) => { if (!condition) throw new Error(label); console.log(`OK ${label}`); };
const view = read("src/components/ProfileView.tsx");
const audio = read("src/components/audio/ProfileAudioSections.tsx");
const hook = read("src/hooks/useAudioCatalog.ts");
const app = read("src/App.tsx");
const service = read("src/services/profileActivityService.ts");

assert(view.includes("ProfileRelationshipSummary") && view.includes("ProfileMutualCommunities"), "relationship and mutual community sections");
assert(view.includes("ProfileHeroGallery") && view.includes("ProfileStats") && view.includes("ProfileActivityList") && view.includes("ProfileSharedMedia"), "core profile sections");
assert(view.includes("Access-filtered sources only") && !view.includes("Visible mock communities only"), "source-neutral access-filtered activity copy");
assert(view.includes('dataState === "loading"') && view.includes('dataState === "error"') && view.includes("onRetryData"), "profile loading error and retry states");
assert(view.includes("profile.isCurrentUser ? audioCatalog.snapshot") && view.includes("savedRadio"), "saved audio is current-user scoped");
assert(audio.includes("AudioMiniPlayer") && audio.includes("PodcastEpisodeDetail") && audio.includes("Try again"), "existing audio player detail and recovery integration");
assert(hook.includes("refresh: () => Promise<void>") && hook.includes("audioDataSource.refresh"), "audio source retry contract");
assert(service.includes('rpc("get_profile_domain_v1"') && app.includes("remoteProfileLoadState"), "real profile domain service and app state");
assert(!view.includes("supabase") && !audio.includes(".from("), "profile UI has no direct Supabase calls");
console.log("OK full profile sections smoke completed");
