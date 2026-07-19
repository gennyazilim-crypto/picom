import { getSupabaseClient } from "../supabase/supabaseClient";
import { profileMediaStore } from "./profileMediaStore";
import { PROFILE_MEDIA_BUCKET, type ProfileMediaAsset, type ProfileMediaRecord } from "./profileMediaTypes";

type RpcAsset = {
  path?: unknown;
  thumbnail_path?: unknown;
  version?: unknown;
  content_hash?: unknown;
  updated_at?: unknown;
  legacy_url?: unknown;
};
type RpcPayload = {
  can_view?: unknown;
  display_name?: unknown;
  avatar?: RpcAsset;
  cover?: RpcAsset;
  updated_at?: unknown;
};

const SIGNED_URL_TTL_SECONDS = 60 * 60;
const REFRESH_HEADROOM_MS = 2 * 60 * 1000;
const inFlight = new Map<string, Promise<ProfileMediaRecord | null>>();

const asString = (value: unknown): string | null => typeof value === "string" && value.length ? value : null;
const asVersion = (value: unknown): number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;

function appendVersion(url: string, version: number): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("v", String(version));
    return parsed.toString();
  } catch {
    return url + (url.includes("?") ? "&" : "?") + "v=" + version;
  }
}

async function sign(path: string | null, version: number): Promise<string | null> {
  if (!path) return null;
  const client = getSupabaseClient();
  if (!client) throw new Error("Profile media is not configured.");
  const { data, error } = await client.storage.from(PROFILE_MEDIA_BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) throw new Error("Picom could not authorize this profile image.");
  return appendVersion(data.signedUrl, version);
}

async function mapAsset(asset: RpcAsset | undefined): Promise<ProfileMediaAsset> {
  const path = asString(asset?.path);
  const thumbnailPath = asString(asset?.thumbnail_path);
  const version = asVersion(asset?.version);
  const legacyUrl = path ? null : asString(asset?.legacy_url);
  const [url, thumbnailUrl] = await Promise.all([
    path ? sign(path, version) : Promise.resolve(legacyUrl ? appendVersion(legacyUrl, version) : null),
    thumbnailPath ? sign(thumbnailPath, version) : Promise.resolve(null),
  ]);
  return {
    path,
    thumbnailPath,
    version,
    contentHash: asString(asset?.content_hash),
    updatedAt: asString(asset?.updated_at),
    legacyUrl,
    url,
    thumbnailUrl,
  };
}

async function fetchRecord(userId: string): Promise<ProfileMediaRecord | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client.rpc("get_profile_media_v1", { target_user_id: userId });
  if (error) throw new Error(error.message || "Picom could not load profile media.");
  const payload = (data ?? {}) as RpcPayload;
  const canView = payload.can_view === true;
  const [avatar, cover] = canView
    ? await Promise.all([mapAsset(payload.avatar), mapAsset(payload.cover)])
    : await Promise.all([mapAsset(undefined), mapAsset(undefined)]);
  return {
    userId,
    canView,
    displayName: asString(payload.display_name),
    avatar,
    cover,
    updatedAt: asString(payload.updated_at),
    signedUrlExpiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
  };
}

export const profileMediaResolver = {
  async resolve(userId: string, options: { force?: boolean } = {}): Promise<ProfileMediaRecord | null> {
    const current = profileMediaStore.getSnapshot(userId);
    if (!options.force && current.record && current.state === "ready"
      && (current.record.signedUrlExpiresAt ?? 0) > Date.now() + REFRESH_HEADROOM_MS) return current.record;
    const pending = inFlight.get(userId);
    if (pending) return pending;
    profileMediaStore.markLoading(userId);
    const request = fetchRecord(userId)
      .then((record) => {
        if (record) profileMediaStore.setReady(record);
        return record;
      })
      .catch((error: unknown) => {
        profileMediaStore.markError(userId, error instanceof Error ? error.message : "Picom could not load profile media.");
        return null;
      })
      .finally(() => inFlight.delete(userId));
    inFlight.set(userId, request);
    return request;
  },
  invalidate(userId: string): void {
    profileMediaStore.invalidate(userId);
  },
  async refreshTracked(): Promise<void> {
    await Promise.allSettled(profileMediaStore.trackedUserIds().map((userId) => this.resolve(userId, { force: true })));
  },
};
