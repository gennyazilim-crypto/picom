import { currentUserId } from "../data/mockCommunities";
import type { ProfileSummary } from "./profileService";
import { profileService } from "./profileService";
import { dataSourceService } from "./dataSourceService";
import { fileService } from "./fileService";
import { getSupabaseClient, getSupabaseClientStatus } from "./supabase/supabaseClient";

export const PROFILE_MEDIA_BUCKET = "profile-media" as const;
export type ProfileMediaKind = "avatar" | "cover";
export type ProfileMediaProgress = Readonly<{ percent: number; stage: "validating" | "preparing" | "uploading" | "saving" | "complete" }>;
export type ProfileMediaErrorCode = "AUTH_REQUIRED" | "VALIDATION_ERROR" | "UPLOAD_CANCELED" | "UPLOAD_FAILED" | "PROFILE_UPDATE_FAILED" | "REMOVE_FAILED";
export type ProfileMediaResult<T> = Readonly<{ ok: true; data: T }> | Readonly<{ ok: false; error: { code: ProfileMediaErrorCode; message: string } }>;

const allowedMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const limits = {
  avatar: { bytes: 5 * 1024 * 1024, minWidth: 128, minHeight: 128 },
  cover: { bytes: 8 * 1024 * 1024, minWidth: 640, minHeight: 200 },
} as const;

function fail(code: ProfileMediaErrorCode, message: string): ProfileMediaResult<never> { return { ok: false, error: { code, message } }; }
function report(callback: ((progress: ProfileMediaProgress) => void) | undefined, percent: number, stage: ProfileMediaProgress["stage"]): void { callback?.({ percent, stage }); }
function extensionFor(file: File): string { return file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"; }
function mediaField(kind: ProfileMediaKind): "avatarUrl" | "coverUrl" { return kind === "avatar" ? "avatarUrl" : "coverUrl"; }

async function dimensions(file: File): Promise<{ width: number; height: number } | null> {
  if (typeof createImageBitmap !== "function") return null;
  try {
    const bitmap = await createImageBitmap(file);
    const result = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return result;
  } catch {
    return null;
  }
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read_failed"));
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("read_failed"));
    reader.readAsDataURL(file);
  });
}

export function extractProfileMediaStoragePath(value?: string | null): string | null {
  if (!value || value.startsWith("data:") || value.startsWith("blob:")) return null;
  const marker = `/storage/v1/object/public/${PROFILE_MEDIA_BUCKET}/`;
  const index = value.indexOf(marker);
  if (index >= 0) return decodeURIComponent(value.slice(index + marker.length).split("?")[0]);
  return /^[0-9a-f-]{36}\/(avatar|cover)\//i.test(value) ? value : null;
}

async function removeStorageObject(path: string | null): Promise<boolean> {
  if (!path) return true;
  const client = getSupabaseClient();
  if (!client) return false;
  const { error } = await client.storage.from(PROFILE_MEDIA_BUCKET).remove([path]);
  return !error;
}

export const profileMediaService = {
  async validateFile(kind: ProfileMediaKind, file: File): Promise<ProfileMediaResult<{ width: number | null; height: number | null }>> {
    if (!allowedMimeTypes.has(file.type)) return fail("VALIDATION_ERROR", "Choose a PNG, JPG, or WEBP image.");
    if (file.size <= 0 || file.size > limits[kind].bytes) return fail("VALIDATION_ERROR", `${kind === "avatar" ? "Avatar" : "Cover"} images must be ${limits[kind].bytes / 1024 / 1024} MB or smaller.`);
    const content = await fileService.validateContent(file);
    if (!content.ok) return fail("VALIDATION_ERROR", content.reason);
    const size = await dimensions(file);
    if (size && (size.width < limits[kind].minWidth || size.height < limits[kind].minHeight)) {
      return fail("VALIDATION_ERROR", kind === "avatar" ? "Avatar images must be at least 128 by 128 pixels." : "Cover images must be at least 640 by 200 pixels.");
    }
    if (size && (size.width > 8192 || size.height > 8192)) return fail("VALIDATION_ERROR", "Image dimensions must not exceed 8192 pixels.");
    return { ok: true, data: { width: size?.width ?? null, height: size?.height ?? null } };
  },

  async replace(kind: ProfileMediaKind, file: File, options: { previousUrl?: string | null; signal?: AbortSignal; onProgress?: (progress: ProfileMediaProgress) => void } = {}): Promise<ProfileMediaResult<ProfileSummary>> {
    report(options.onProgress, 5, "validating");
    const validation = await this.validateFile(kind, file);
    if (!validation.ok) return validation;
    if (options.signal?.aborted) return fail("UPLOAD_CANCELED", "Upload canceled.");
    report(options.onProgress, 18, "preparing");

    if (dataSourceService.getStatus().isMock) {
      try {
        const dataUrl = await fileToDataUrl(file);
        if (options.signal?.aborted) return fail("UPLOAD_CANCELED", "Upload canceled.");
        report(options.onProgress, 72, "uploading");
        const updated = await profileService.updateCurrentProfile({ [mediaField(kind)]: dataUrl });
        if (!updated.ok) return fail("PROFILE_UPDATE_FAILED", updated.error.message);
        report(options.onProgress, 100, "complete");
        return { ok: true, data: updated.data };
      } catch {
        return fail("UPLOAD_FAILED", "Picom could not prepare this image.");
      }
    }

    const status = getSupabaseClientStatus();
    const client = getSupabaseClient();
    if (!status.configured || !client) return fail("UPLOAD_FAILED", status.reason ?? "Profile media storage is unavailable.");
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) return fail("AUTH_REQUIRED", "Sign in before changing profile media.");
    const userId = userData.user.id;
    const storagePath = `${userId}/${kind}/${crypto.randomUUID()}.${extensionFor(file)}`;
    report(options.onProgress, 35, "uploading");
    const upload = await client.storage.from(PROFILE_MEDIA_BUCKET).upload(storagePath, file, { cacheControl: "3600", contentType: file.type, upsert: false });
    if (upload.error) return fail("UPLOAD_FAILED", "Picom could not upload this profile image.");
    if (options.signal?.aborted) {
      await removeStorageObject(storagePath);
      return fail("UPLOAD_CANCELED", "Upload canceled.");
    }
    report(options.onProgress, 78, "saving");
    const publicUrl = client.storage.from(PROFILE_MEDIA_BUCKET).getPublicUrl(storagePath).data.publicUrl;
    const updated = await profileService.updateCurrentProfile({ [mediaField(kind)]: publicUrl });
    if (!updated.ok) {
      await removeStorageObject(storagePath);
      return fail("PROFILE_UPDATE_FAILED", updated.error.message);
    }
    const previousPath = extractProfileMediaStoragePath(options.previousUrl);
    if (previousPath && previousPath !== storagePath) await removeStorageObject(previousPath);
    report(options.onProgress, 100, "complete");
    return { ok: true, data: updated.data };
  },

  async remove(kind: ProfileMediaKind, currentUrl?: string | null): Promise<ProfileMediaResult<ProfileSummary>> {
    const updated = await profileService.updateCurrentProfile({ [mediaField(kind)]: null });
    if (!updated.ok) return fail("PROFILE_UPDATE_FAILED", updated.error.message);
    if (!dataSourceService.getStatus().isMock) {
      const removed = await removeStorageObject(extractProfileMediaStoragePath(currentUrl));
      if (!removed) return fail("REMOVE_FAILED", "Profile was updated, but the old image could not be removed. Cleanup will retry safely.");
    }
    return { ok: true, data: updated.data };
  },
};
