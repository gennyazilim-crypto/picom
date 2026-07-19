import type { ProfileSummary } from "./profileService";
import { profileService } from "./profileService";
import { profileMediaUploadService } from "./profileMedia/profileMediaUploadService";
import {
  PROFILE_MEDIA_BUCKET,
  type ProfileMediaCrop,
  type ProfileMediaErrorCode,
  type ProfileMediaKind,
  type ProfileMediaProgress,
  type ProfileMediaRecord,
  type ProfileMediaResult,
} from "./profileMedia/profileMediaTypes";

export { PROFILE_MEDIA_BUCKET };
export type { ProfileMediaCrop, ProfileMediaErrorCode, ProfileMediaKind, ProfileMediaProgress, ProfileMediaResult };

const DEFAULT_CROP: ProfileMediaCrop = { zoom: 1, rotation: 0, offsetX: 0, offsetY: 0 };

export function extractProfileMediaStoragePath(value?: string | null): string | null {
  if (!value || value.startsWith("data:") || value.startsWith("blob:")) return null;
  const withoutQuery = value.split("?", 1)[0];
  const marker = new RegExp("/storage/v1/object/(?:public|sign|authenticated)/" + PROFILE_MEDIA_BUCKET + "/", "i");
  const match = marker.exec(withoutQuery);
  if (match) return decodeURIComponent(withoutQuery.slice(match.index + match[0].length));
  return /^(?:avatars|covers|thumbnails)\/[0-9a-f-]{36}\/[A-Za-z0-9._/-]+$/i.test(withoutQuery)
    || /^[0-9a-f-]{36}\/(?:avatar|cover)\/[A-Za-z0-9._/-]+$/i.test(withoutQuery)
    ? withoutQuery
    : null;
}

async function toProfileSummary(
  userId: string,
  record: ProfileMediaRecord,
): Promise<ProfileMediaResult<ProfileSummary>> {
  const profile = await profileService.getProfileById(userId);
  if (!profile.ok) return { ok: false, error: { code: "PROFILE_UPDATE_FAILED", message: profile.error.message } };
  if (!profile.data) return { ok: false, error: { code: "PROFILE_UPDATE_FAILED", message: "Picom could not refresh the updated profile." } };
  return {
    ok: true,
    data: {
      ...profile.data,
      avatarUrl: record.avatar.thumbnailUrl ?? record.avatar.url ?? undefined,
      coverUrl: record.cover.url ?? undefined,
    },
  };
}

export const profileMediaService = {
  validateFile(kind: ProfileMediaKind, file: File, signal?: AbortSignal) {
    return profileMediaUploadService.validateFile(kind, file, signal);
  },
  async replace(
    kind: ProfileMediaKind,
    file: File,
    options: {
      previousUrl?: string | null;
      crop?: ProfileMediaCrop;
      signal?: AbortSignal;
      onProgress?: (progress: ProfileMediaProgress) => void;
    } = {},
  ): Promise<ProfileMediaResult<ProfileSummary>> {
    const result = await profileMediaUploadService.replace(kind, file, {
      crop: options.crop ?? DEFAULT_CROP,
      signal: options.signal,
      onProgress: options.onProgress,
    });
    if (!result.ok) return result;
    return toProfileSummary(result.data.userId, result.data.record);
  },
  async remove(kind: ProfileMediaKind, _currentUrl?: string | null): Promise<ProfileMediaResult<ProfileSummary>> {
    const result = await profileMediaUploadService.remove(kind);
    if (!result.ok) return result;
    return toProfileSummary(result.data.userId, result.data.record);
  },
};
