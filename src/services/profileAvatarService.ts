import { getSupabaseClient } from "./supabase/supabaseClient";
import { profileService } from "./profileService";
import { extractProfileMediaStoragePath } from "./profileMediaService";
import type { IncomingVoiceCall, VoiceCallParty } from "./voice/voiceCallInviteService";

const PROFILE_MEDIA_BUCKET = "profile-media";
const SIGNED_URL_TTL_SECONDS = 15 * 60;

type CallerProfileRow = Readonly<{
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  avatar_path: string | null;
  avatar_updated_at: string | null;
}>;

export type ResolvedCallAvatar = VoiceCallParty & Readonly<{
  username?: string;
  avatarPath?: string;
  avatarUpdatedAt?: string;
}>;

const pendingResolutions = new Map<string, Promise<ResolvedCallAvatar>>();

function firstRow(value: unknown): CallerProfileRow | null {
  const row = Array.isArray(value) ? value[0] : null;
  if (!row || typeof row !== "object") return null;
  const candidate = row as Partial<CallerProfileRow>;
  if (typeof candidate.user_id !== "string") return null;
  return {
    user_id: candidate.user_id,
    display_name: typeof candidate.display_name === "string" ? candidate.display_name : null,
    username: typeof candidate.username === "string" ? candidate.username : null,
    avatar_url: typeof candidate.avatar_url === "string" ? candidate.avatar_url : null,
    avatar_path: typeof candidate.avatar_path === "string" ? candidate.avatar_path : null,
    avatar_updated_at:
      typeof candidate.avatar_updated_at === "string" ? candidate.avatar_updated_at : null,
  };
}

async function signedProfileMediaUrl(path: string | undefined): Promise<string | undefined> {
  if (!path) return undefined;
  const client = getSupabaseClient();
  if (!client) return undefined;
  const { data, error } = await client.storage
    .from(PROFILE_MEDIA_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return undefined;
  return data.signedUrl;
}

async function resolveDirectCaller(call: IncomingVoiceCall): Promise<ResolvedCallAvatar | null> {
  if (call.room.kind !== "direct") return null;
  const client = getSupabaseClient();
  if (!client) return null;

  const rpc = client.rpc as unknown as (
    name: string,
    args: { target_call_id: string },
  ) => Promise<{ data: unknown; error: { message?: string } | null }>;
  const { data, error } = await rpc("resolve_incoming_call_caller_profile", {
    target_call_id: call.room.callId,
  });
  if (error) return null;

  const row = firstRow(data);
  if (!row || row.user_id !== call.caller.id) return null;
  const avatarPath = row.avatar_path ?? extractProfileMediaStoragePath(row.avatar_url ?? undefined) ?? undefined;
  const signedUrl = await signedProfileMediaUrl(avatarPath);
  return {
    id: row.user_id,
    name: row.display_name?.trim() || call.caller.name,
    username: row.username?.trim() || undefined,
    avatarUrl: signedUrl ?? row.avatar_url ?? undefined,
    avatarPath,
    avatarUpdatedAt: row.avatar_updated_at ?? undefined,
  };
}

async function resolveProfileFallback(call: IncomingVoiceCall): Promise<ResolvedCallAvatar> {
  const result = await profileService.getProfileById(call.caller.id);
  if (!result.ok || !result.data) return { id: call.caller.id, name: call.caller.name, username: call.caller.username };
  const profile = result.data;
  const avatarPath = extractProfileMediaStoragePath(profile.avatarUrl) ?? undefined;
  const signedUrl = await signedProfileMediaUrl(avatarPath);
  return {
    id: call.caller.id,
    name: profile.displayName?.trim() || call.caller.name,
    username: profile.username?.trim() || undefined,
    avatarUrl: signedUrl ?? profile.avatarUrl ?? call.caller.avatarUrl,
    avatarPath,
    avatarUpdatedAt: profile.updatedAt ?? undefined,
  };
}

export const profileAvatarService = {
  async resolveIncomingCaller(call: IncomingVoiceCall): Promise<ResolvedCallAvatar> {
    const key = call.room.kind === "direct" ? call.room.callId : call.inviteId;
    const existing = pendingResolutions.get(key);
    if (existing) return existing;
    const resolution = (async () => {
      try {
        return (await resolveDirectCaller(call)) ?? (await resolveProfileFallback(call));
      } catch {
        return { id: call.caller.id, name: call.caller.name, username: call.caller.username };
      }
    })().finally(() => pendingResolutions.delete(key));
    pendingResolutions.set(key, resolution);
    return resolution;
  },
};
