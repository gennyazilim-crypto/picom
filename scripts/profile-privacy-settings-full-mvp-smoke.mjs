import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const settings = read("src/components/SettingsModal.tsx");
const app = read("src/App.tsx");
const profileService = read("src/services/profileService.ts");
const privacyService = read("src/services/profilePrivacyService.ts");
const safetyService = read("src/services/userSafetyCenterService.ts");
const blockingService = read("src/services/userBlockingService.ts");
const directSafety = read("src/services/directMessages/directSafetyService.ts");
const profileView = read("src/components/ProfileView.tsx");
const privacyMigration = read("supabase/migrations/20260711002600_profile_schema_privacy_services_full_mvp.sql");
const accessMigration = read("supabase/migrations/20260711002800_profile_access_cross_community_privacy.sql");
const friendMigration = read("supabase/migrations/20260710189000_friend_requests_production.sql");
const dmMigration = read("supabase/migrations/20260711002500_dm_privacy_safety_full_mvp.sql");

const requireAll = (source, markers, label) => {
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length) throw new Error(label + ": missing " + missing.join(", "));
};

requireAll(settings, ["profileService.updateCurrentProfile", "profilePrivacyService.updateOwn", "refreshRemoteBlocks", "refreshRemotePrivacy", "updateFriendRequestPrivacy", "updateDirectMessagePrivacy", "Public and visitor visibility"], "Settings integration");
for (const field of ["showOnlineStatus", "showLocation", "showTimezone", "showActivity", "showMedia", "showCommunities", "showFriends", "showFollows", "showAudio"]) requireAll(settings, [field], "Settings privacy field");
requireAll(profileService, ["updateCurrentProfile", "avatarUrl", "coverUrl", "location", "timezone"], "profile identity service");
requireAll(privacyService, ["getOwnSettings", "updateOwn", "getProjection", "applyProjection", "subscribe(listener"], "profile privacy service");
requireAll(safetyService, ["updateFriendRequestPrivacy", "friend_request_privacy", "writeSettings(previous)"], "friend privacy rollback");
requireAll(blockingService, ["refreshRemoteBlocks", "setBlockedUser", "block_user", "unblock_user"], "blocked-user management");
requireAll(directSafety, ["get_direct_message_privacy", "update_direct_message_privacy"], "DM privacy service");
requireAll(app, ["profilePrivacyService.subscribe", "setProfilePrivacyProjection"], "open Profile synchronization");
for (const field of ["showCommunities", "showFollows", "showAudio"]) requireAll(profileView, ["profile.privacy." + field], "ProfileView privacy rendering");
requireAll(privacyMigration, ["update_profile_privacy_v3", "get_profile_privacy_projection_v3", "show_friends", "show_follows", "show_audio"], "profile privacy RPC");
requireAll(accessMigration, ["users_are_blocked", "can_view_profile", "show_activity", "show_media"], "cross-community privacy boundary");
requireAll(friendMigration, ["friend_request_privacy", "FRIEND_REQUEST_PRIVACY"], "friend request RLS/RPC policy");
requireAll(dmMigration, ["dm_privacy", "update_direct_message_privacy"], "DM privacy policy");
if (settings.includes("<strong>Who can message me</strong>")) throw new Error("Duplicate local-only DM policy control remains.");
if (/from\(["']/.test(settings)) throw new Error("Settings components must not call Supabase directly.");

console.log("Profile edit synchronization, privacy projection, DM/friend policy, blocking, visitor, and no-leak contracts passed.");
