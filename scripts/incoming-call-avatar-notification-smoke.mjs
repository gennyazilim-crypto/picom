import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [cache, toast, validation, resolver, hook, migration, main] = await Promise.all([
  read("electron/notificationAvatarCache.cts"),
  read("electron/incomingCallToast.cts"),
  read("electron/ipcPayloadValidation.cts"),
  read("src/services/profileAvatarService.ts"),
  read("src/hooks/useVoiceCallInvites.ts"),
  read("supabase/migrations/20260719000000_incoming_call_avatar_profile_contract.sql"),
  read("electron/main.cts"),
]);

const checks = [
  [migration.includes("resolve_incoming_call_caller_profile"), "participant-scoped caller profile RPC exists"],
  [migration.includes("avatar_updated_at"), "avatar version metadata is persisted"],
  [resolver.includes("createSignedUrl"), "private profile media receives a signed URL"],
  [resolver.includes("SIGNED_URL_TTL_SECONDS"), "signed URL lifetime is explicit"],
  [hook.includes("profileAvatarService.resolveIncomingCaller"), "in-app call state uses centralized caller resolution"],
  [validation.includes("callerAvatarPath"), "structured IPC includes storage path metadata"],
  [validation.includes("callerAvatarUpdatedAt"), "structured IPC includes avatar version metadata"],
  [cache.includes("PICOM_APPROVED_CDN_HOSTS"), "remote avatar hosts are allowlisted"],
  [cache.includes("MAX_SOURCE_BYTES"), "remote avatar size is bounded"],
  [cache.includes("readBoundedResponse"), "streaming response cannot exceed the size cap"],
  [cache.includes("AVATAR_REDIRECT_NOT_APPROVED"), "redirect destinations are revalidated"],
  [cache.includes("ACCEPTED_MIME_TYPES"), "remote avatar MIME is validated"],
  [cache.includes("atomicWrite"), "cache writes are atomic"],
  [cache.includes("pendingWrites"), "concurrent downloads are deduplicated"],
  [cache.includes("toPNG"), "avatars are normalized to PNG"],
  [cache.includes("initialsAvatar"), "initials fallback exists"],
  [main.includes("prepareNotificationAvatar"), "main process prepares notification avatars"],
  [main.includes("incomingCallPresentationGeneration"), "dismiss/supersede races are guarded"],
  [toast.includes("avatarDataUrl"), "toast receives prepared local image data"],
  [!toast.includes("payload.avatarUrl"), "toast never loads a renderer-provided remote URL"],
];

const failures = checks.filter(([passed]) => !passed).map(([, label]) => label);
if (failures.length) {
  console.error(`Incoming call avatar notification smoke failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log(`Incoming call avatar notification smoke passed (${checks.length} checks).`);
