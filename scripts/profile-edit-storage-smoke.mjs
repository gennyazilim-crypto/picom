import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const assert = (condition, label) => { if (!condition) throw new Error(label); console.log(`OK ${label}`); };
const service = read("src/services/profileMediaService.ts");
const editor = read("src/components/settings/ProfileMediaEditor.tsx");
const settings = read("src/components/SettingsModal.tsx");
const profile = read("src/components/ProfileView.tsx");
const migration = read("supabase/migrations/20260711002700_profile_media_storage_full_mvp.sql");
const lifecycle = read("supabase/migrations/20260711151400_storage_lifecycle_full_mvp.sql");

assert(service.includes('PROFILE_MEDIA_BUCKET = "profile-media"'), "dedicated profile media bucket");
assert(service.includes("validateFile") && service.includes("fileService.validateContent"), "profile media validation");
assert(service.includes("onProgress") && service.includes("previousUrl"), "upload progress and replacement cleanup");
assert(service.includes("profileService.updateCurrentProfile"), "profile media persists through service layer");
assert(editor.includes("Retry upload") && editor.includes("Remove") && editor.includes("<progress"), "recoverable media editor controls");
assert(settings.includes("Preferred language") && settings.includes("Manage profile privacy") && settings.includes("PROFILE_UPDATE" ) === false, "complete profile fields and privacy navigation");
assert(profile.includes("onEditProfile") && !profile.includes("Edit profile placeholder opened locally"), "current-user profile edit entrypoint");
assert(migration.includes("profile_media_insert_own") && migration.includes("auth.uid()::text") && migration.includes("profile_media_delete_own"), "owner-scoped storage RLS");
assert(migration.includes("alter table public.profile_details add constraint profile_details_cover_url_safe") && !migration.includes("alter table public.profiles add constraint profiles_cover_url_safe"), "cover URL constraint follows canonical profile_details storage");
assert(lifecycle.includes("left join public.profile_details details") && lifecycle.includes("details.cover_url"), "orphan scan follows canonical profile cover storage");
assert(!editor.includes("supabase") && !profile.includes("supabase.from"), "UI remains behind service boundary");
console.log("OK profile edit and storage smoke completed");
