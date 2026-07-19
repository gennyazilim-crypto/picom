import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const migration = read("supabase/migrations/20260719010000_profile_media_centralized_rebuild.sql");
const facade = read("src/services/profileMediaService.ts");
const upload = read("src/services/profileMedia/profileMediaUploadService.ts");
const resolver = read("src/services/profileMedia/profileMediaResolver.ts");
const realtime = read("src/services/profileMedia/profileMediaRealtimeService.ts");
const store = read("src/services/profileMedia/profileMediaStore.ts");
const worker = read("src/services/profileMedia/profileMediaImage.worker.ts");
const editor = read("src/components/settings/ProfileMediaEditor.tsx");
const memberAvatar = read("src/components/MemberAvatar.tsx");
const avatar = read("src/components/UserAvatar.tsx");
const cover = read("src/components/ProfileCover.tsx");
const profile = read("src/components/ProfileView.tsx");
const notificationCache = read("electron/notificationAvatarCache.cts");

const checks = [
  ["private profile-media bucket", /values\s*\('profile-media',\s*'profile-media',\s*false/i.test(migration)],
  ["canonical immutable avatar paths", migration.includes("avatars/") && migration.includes("avatar_version")],
  ["canonical immutable cover paths", migration.includes("covers/") && migration.includes("cover_version")],
  ["privacy-aware storage read", migration.includes("can_view_profile_media_object")],
  ["owner-only storage write", migration.includes("profile_media_canonical_insert") && migration.includes("auth.uid()")],
  ["atomic commit RPC", migration.includes("commit_profile_media_v1") && migration.includes("for update")],
  ["atomic remove RPC", migration.includes("remove_profile_media_v1")],
  ["signed URL resolver", resolver.includes("createSignedUrl") && resolver.includes("signedUrlExpiresAt")],
  ["versioned cache URL", resolver.includes('searchParams.set("v"')],
  ["stale store rejection", store.includes("isStale") && store.includes("incoming.avatar.version < current.avatar.version")],
  ["single realtime channel", realtime.includes('channel("profile-media:centralized:v1")')],
  ["callbacks registered before subscribe", realtime.indexOf('.on("postgres_changes"') < realtime.indexOf(".subscribe(")],
  ["worker processing", worker.includes("OffscreenCanvas") && worker.includes("createImageBitmap")],
  ["magic-byte validation", worker.includes("hasExpectedSignature")],
  ["real XHR progress", upload.includes("xhr.upload.onprogress")],
  ["rollback cleanup", upload.includes("await removeObjects(uploadedPaths)")],
  ["content dedupe", upload.includes("contentHash === processed.hash")],
  ["no mock/data URL upload branch", !facade.includes("isMock") && !facade.includes("fileToDataUrl")],
  ["central UserAvatar", memberAvatar.includes("<UserAvatar") && avatar.includes("useProfileMedia")],
  ["central ProfileCover", profile.includes("<ProfileCover") && cover.includes("useProfileMedia")],
  ["desktop crop workflow", editor.includes("CROP AND PREVIEW") && editor.includes("Rotate 90 degrees")],
  ["drop and paste workflow", editor.includes("onDrop") && editor.includes("onPaste")],
  ["notification version cache", notificationCache.includes("callerAvatarUpdatedAt") && notificationCache.includes("sourceCacheKey")],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log((ok ? "PASS" : "FAIL") + " " + name);
if (failed.length) {
  console.error("Profile media contract failed: " + failed.map(([name]) => name).join(", "));
  process.exit(1);
}
console.log("Profile media centralized smoke passed (" + checks.length + " checks).");
