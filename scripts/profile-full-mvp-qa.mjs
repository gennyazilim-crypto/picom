import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const json = (path) => JSON.parse(read(path));
const assert = (condition, label) => { if (!condition) throw new Error(label); console.log(`OK ${label}`); };

const app = read("src/App.tsx");
const profile = read("src/components/ProfileView.tsx");
const editor = read("src/components/settings/ProfileMediaEditor.tsx");
const privacy = read("src/services/profilePrivacyService.ts");
const relationships = read("src/services/relationshipService.ts");
const rlsMatrix = read("supabase/tests/rls/profile_access_cross_community_privacy.sql");
const visual = json("tests/visual/visual-regression-manifest.json");
const e2e = json("tests/e2e/e2e-coverage-manifest.json");

assert(!profile.includes("placeholder") && !app.includes("Profile activity highlight placeholder"), "no profile acceptance-path placeholder");
assert(app.includes("setHighlightedMessageId(messageId)") && app.includes("switchCommunity(activity.communityId, activity.channelId)"), "profile activity deep-link and highlight");
assert(profile.includes("ProfileHeroGallery") && profile.includes("ProfileRelationshipSummary") && profile.includes("ProfileMutualCommunities") && profile.includes("ProfileAudioSections"), "complete profile viewing sections");
assert(editor.includes("Retry upload") && editor.includes("Remove") && editor.includes("<progress"), "recoverable avatar and cover editing");
assert(profile.includes("Cancel request") && profile.includes("Accept request") && profile.includes("Remove friend") && relationships.includes("follow_user"), "relationship action states and service path");
assert(privacy.includes("showActivity") && privacy.includes("showMedia") && privacy.includes("showAudio"), "profile privacy controls");
assert(rlsMatrix.includes("select plan(26)") && rlsMatrix.includes("blocked user cannot view profile basics") && rlsMatrix.includes("removing community access removes profile activity visibility"), "profile privacy role-user matrix");

const profileVariants = new Set(visual.scenarios.filter((scenario) => scenario.screen === "profile").map((scenario) => scenario.variant));
for (const variant of ["current_verified", "other_unverified", "blocked", "public", "private", "empty_media"]) assert(profileVariants.has(variant), `visual profile variant ${variant}`);
const profileFlow = e2e.flows.find((flow) => flow.id === "full-profile");
assert(profileFlow?.mockUi === "planned" && profileFlow?.stagingUi === "planned", "UI E2E remains truthfully planned");
for (const command of ["profile:edit-storage:smoke", "profile:sections:smoke", "profile:relationships:smoke", "profile:access:smoke"]) assert(profileFlow?.preflightCommands.includes(command), `profile E2E preflight ${command}`);
assert(!profile.includes("supabase") && !editor.includes("supabase"), "profile components remain behind service boundaries");
console.log("OK profile Full MVP QA contract completed");
