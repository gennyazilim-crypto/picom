import { dataSourceService } from "../dataSourceService";
import { getSupabaseClient } from "../supabase/supabaseClient";
import { profileMediaImageProcessor } from "./profileMediaImageProcessor";
import { profileMediaInvalidationService } from "./profileMediaInvalidationService";
import { profileMediaResolver } from "./profileMediaResolver";
import {
  PROFILE_MEDIA_BUCKET,
  type ProfileMediaCrop,
  type ProfileMediaErrorCode,
  type ProfileMediaKind,
  type ProfileMediaProgress,
  type ProfileMediaRecord,
  type ProfileMediaResult,
} from "./profileMediaTypes";

type UploadResult = { userId: string; record: ProfileMediaRecord };
type CommitPayload = {
  version?: unknown;
  old_path?: unknown;
  old_thumbnail_path?: unknown;
};

const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const LIMITS = {
  avatar: { bytes: 8 * 1024 * 1024, minWidth: 128, minHeight: 128 },
  cover: { bytes: 12 * 1024 * 1024, minWidth: 640, minHeight: 200 },
} as const;

function makeFailure(code: ProfileMediaErrorCode, message: string): ProfileMediaResult<never> {
  return { ok: false, error: { code, message } };
}

function fail<T>(code: ProfileMediaErrorCode, message: string): ProfileMediaResult<T> {
  return makeFailure(code, message);
}

function report(callback: ((progress: ProfileMediaProgress) => void) | undefined, percent: number, stage: ProfileMediaProgress["stage"]): void {
  callback?.({ percent: Math.max(0, Math.min(100, Math.round(percent))), stage });
}

function storageUrl(path: string): string {
  const baseUrl = dataSourceService.getSupabaseConfig().url.replace(/\/+$/, "");
  return baseUrl + "/storage/v1/object/" + PROFILE_MEDIA_BUCKET + "/" + path.split("/").map(encodeURIComponent).join("/");
}

async function uploadObject(
  path: string,
  blob: Blob,
  accessToken: string,
  signal: AbortSignal | undefined,
  onProgress: (ratio: number) => void,
): Promise<void> {
  const { anonKey } = dataSourceService.getSupabaseConfig();
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    signal?.addEventListener("abort", abort, { once: true });
    xhr.open("POST", storageUrl(path));
    xhr.setRequestHeader("Authorization", "Bearer " + accessToken);
    xhr.setRequestHeader("apikey", anonKey);
    xhr.setRequestHeader("Content-Type", "image/webp");
    xhr.setRequestHeader("cache-control", "31536000, immutable");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onerror = () => reject(new Error("Profile image upload could not reach storage."));
    xhr.onabort = () => reject(new DOMException("Upload canceled.", "AbortError"));
    xhr.onload = () => {
      signal?.removeEventListener("abort", abort);
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error("Storage rejected the profile image (" + xhr.status + ")."));
    };
    xhr.send(blob);
  });
}

async function removeObjects(paths: Array<string | null | undefined>): Promise<void> {
  const client = getSupabaseClient();
  const unique = Array.from(new Set(paths.filter((path): path is string => Boolean(path))));
  if (client && unique.length) await client.storage.from(PROFILE_MEDIA_BUCKET).remove(unique);
}

function parsePayload(value: unknown): CommitPayload {
  return value && typeof value === "object" ? value as CommitPayload : {};
}

function errorResult<T>(error: unknown, fallbackCode: "UPLOAD_FAILED" | "REMOVE_FAILED"): ProfileMediaResult<T> {
  if (error instanceof DOMException && error.name === "AbortError") return fail("UPLOAD_CANCELED", "Upload canceled.");
  const message = error instanceof Error ? error.message : "Profile media operation failed.";
  if (message.includes("VERSION_CONFLICT") || message.includes("40001")) {
    return fail("VERSION_CONFLICT", "Your profile image changed in another window. Picom refreshed it; try again.");
  }
  return fail(fallbackCode, message);
}

export const profileMediaUploadService = {
  async validateFile(kind: ProfileMediaKind, file: File, signal?: AbortSignal): Promise<ProfileMediaResult<{ width: number; height: number }>> {
    const limit = LIMITS[kind];
    if (!ALLOWED_MIME_TYPES.has(file.type)) return fail("VALIDATION_ERROR", "Choose a PNG, JPG, or WEBP image.");
    if (file.size <= 0 || file.size > limit.bytes) {
      return fail("VALIDATION_ERROR", (kind === "avatar" ? "Avatar" : "Cover") + " images must be " + (limit.bytes / 1024 / 1024) + " MB or smaller.");
    }
    try {
      const dimensions = await profileMediaImageProcessor.inspect(file, signal);
      if (dimensions.width < limit.minWidth || dimensions.height < limit.minHeight) {
        return fail("VALIDATION_ERROR", kind === "avatar"
          ? "Avatar images must be at least 128 by 128 pixels."
          : "Cover images must be at least 640 by 200 pixels.");
      }
      return { ok: true, data: dimensions };
    } catch (error) {
      return errorResult(error, "UPLOAD_FAILED");
    }
  },

  async replace(
    kind: ProfileMediaKind,
    file: File,
    options: {
      crop: ProfileMediaCrop;
      signal?: AbortSignal;
      onProgress?: (progress: ProfileMediaProgress) => void;
    },
  ): Promise<ProfileMediaResult<UploadResult>> {
    if (navigator.onLine === false) return fail("OFFLINE", "Connect to the internet before changing profile images.");
    const client = getSupabaseClient();
    if (!client) return fail("CONFIG_REQUIRED", "Supabase profile media is not configured.");
    const { data: userData } = await client.auth.getUser();
    const user = userData.user;
    if (!user) return fail("AUTH_REQUIRED", "Sign in before changing profile images.");
    report(options.onProgress, 2, "validating");
    const validation = await this.validateFile(kind, file, options.signal);
    if (!validation.ok) return validation;
    report(options.onProgress, 10, "processing");

    let uploadedPaths: string[] = [];
    try {
      const processed = await profileMediaImageProcessor.process(file, kind, options.crop, options.signal);
      const current = await profileMediaResolver.resolve(user.id, { force: true });
      if (!current) return fail("PROFILE_UPDATE_FAILED", "Picom could not load the current profile media version.");
      const currentAsset = current[kind];
      if (currentAsset.contentHash === processed.hash) return { ok: true, data: { userId: user.id, record: current } };
      const expectedVersion = currentAsset.version;
      const nextVersion = expectedVersion + 1;
      const path = kind + "s/" + user.id + "/" + kind + "-" + nextVersion + ".webp";
      const thumbnailPath = "thumbnails/" + kind + "s/" + user.id + "/" + kind + "-" + nextVersion + ".webp";
      const { data: sessionData } = await client.auth.getSession();
      if (!sessionData.session?.access_token) return fail("AUTH_REQUIRED", "Your session expired. Sign in again.");

      report(options.onProgress, 22, "uploading");
      await uploadObject(path, processed.blob, sessionData.session.access_token, options.signal, (ratio) => {
        report(options.onProgress, 22 + ratio * 58, "uploading");
      });
      uploadedPaths.push(path);
      await uploadObject(thumbnailPath, processed.thumbnail, sessionData.session.access_token, options.signal, (ratio) => {
        report(options.onProgress, 80 + ratio * 10, "uploading");
      });
      uploadedPaths.push(thumbnailPath);

      report(options.onProgress, 92, "saving");
      const { data, error } = await client.rpc("commit_profile_media_v1", {
        target_kind: kind,
        target_path: path,
        target_thumbnail_path: thumbnailPath,
        target_content_hash: processed.hash,
        expected_version: expectedVersion,
      });
      if (error) throw new Error(error.message);
      const committed = parsePayload(data);
      const version = typeof committed.version === "number" ? committed.version : nextVersion;
      profileMediaInvalidationService.invalidate(user.id, kind, version);
      const record = await profileMediaResolver.resolve(user.id, { force: true });
      if (!record) throw new Error("Picom saved the image but could not refresh the profile.");
      uploadedPaths = [];
      void removeObjects([
        typeof committed.old_path === "string" ? committed.old_path : null,
        typeof committed.old_thumbnail_path === "string" ? committed.old_thumbnail_path : null,
      ]);
      report(options.onProgress, 100, "complete");
      return { ok: true, data: { userId: user.id, record } };
    } catch (error) {
      await removeObjects(uploadedPaths);
      return errorResult(error, "UPLOAD_FAILED");
    }
  },

  async remove(kind: ProfileMediaKind): Promise<ProfileMediaResult<UploadResult>> {
    if (navigator.onLine === false) return fail("OFFLINE", "Connect to the internet before removing profile images.");
    const client = getSupabaseClient();
    if (!client) return fail("CONFIG_REQUIRED", "Supabase profile media is not configured.");
    const { data: userData } = await client.auth.getUser();
    const user = userData.user;
    if (!user) return fail("AUTH_REQUIRED", "Sign in before changing profile images.");
    try {
      const current = await profileMediaResolver.resolve(user.id, { force: true });
      if (!current) return fail("PROFILE_UPDATE_FAILED", "Picom could not load the current profile media version.");
      const { data, error } = await client.rpc("remove_profile_media_v1", {
        target_kind: kind,
        expected_version: current[kind].version,
      });
      if (error) throw new Error(error.message);
      const removed = parsePayload(data);
      profileMediaInvalidationService.invalidate(user.id, kind, current[kind].version + 1);
      const record = await profileMediaResolver.resolve(user.id, { force: true });
      if (!record) throw new Error("Picom removed the image but could not refresh the profile.");
      void removeObjects([
        typeof removed.old_path === "string" ? removed.old_path : null,
        typeof removed.old_thumbnail_path === "string" ? removed.old_thumbnail_path : null,
      ]);
      return { ok: true, data: { userId: user.id, record } };
    } catch (error) {
      return errorResult(error, "REMOVE_FAILED");
    }
  },
};
