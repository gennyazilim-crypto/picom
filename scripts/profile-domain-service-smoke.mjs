import { readFileSync } from "node:fs";

const types = readFileSync("src/types/profile.ts", "utf8");
const privacyTypes = readFileSync("src/types/profilePrivacy.ts", "utf8");
const profileService = readFileSync("src/services/profileService.ts", "utf8");
const activityService = readFileSync("src/services/profileActivityService.ts", "utf8");
const privacyService = readFileSync("src/services/profilePrivacyService.ts", "utf8");
const migration = readFileSync("supabase/migrations/20260711002600_profile_schema_privacy_services_full_mvp.sql", "utf8");
const view = readFileSync("src/components/ProfileView.tsx", "utf8");

for (const marker of ["coverUrl", "preferredLanguage", "tags", "roles", "stats", "verification", "onboardingCompleted", "privacy"]) if (!types.includes(marker)) throw new Error(`Canonical UserProfile is missing ${marker}`);
for (const marker of ["showCommunities", "showFriends", "showFollows", "showAudio"]) if (!privacyTypes.includes(marker)) throw new Error(`Profile privacy type is missing ${marker}`);
for (const marker of ["get_profile_domain_v1", "update_own_profile_domain", "ProfileSummary = Readonly<Pick<UserProfile", "coverUrl", "preferredLanguage", "tags"]) if (!profileService.includes(marker)) throw new Error(`Profile service is missing ${marker}`);
if (profileService.includes('.from("profiles")')) throw new Error("Profile service bypasses the canonical privacy-projected repository RPC.");
for (const marker of ["profile_details_owner_select", "get_profile_privacy_projection_v3", "public.can_view_message", "show_communities", "show_friends", "show_follows", "show_audio", "update_own_profile_domain", "revoke all on public.profile_details"]) if (!migration.includes(marker) && !readFileSync("supabase/migrations/20260710201000_profile_activity_production.sql", "utf8").includes(marker)) throw new Error(`Profile migration is missing ${marker}`);
for (const marker of ["get_profile_domain_v1", "privacyRestricted", "showAudio"]) if (!activityService.includes(marker) && !privacyService.includes(marker) && !view.includes(marker)) throw new Error(`Profile projection wiring is missing ${marker}`);
console.log("Canonical profile domain, repository, privacy, and no-leak contracts passed.");
