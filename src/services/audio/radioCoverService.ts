import { dataSourceService } from "../dataSourceService";
import { getSupabaseClient } from "../supabase/supabaseClient";
import type { AudioServiceResult } from "./audioDataSource";

export type RadioCoverUpload = Readonly<{ url: string; storagePath?: string }>;
export type RadioCoverUploadOptions = Readonly<{ signal?: AbortSignal; onProgress?: (progress: Readonly<{ percent: number; stage: "validating" | "uploading" | "finalizing" }>) => void }>;
const allowedTypes = new Map([["image/png", "png"], ["image/jpeg", "jpg"], ["image/webp", "webp"], ["image/gif", "gif"]]);
const maxCoverBytes = 5 * 1024 * 1024;
const fail = <T,>(code: "AUDIO_BACKEND_UNAVAILABLE" | "AUDIO_REQUEST_FAILED" | "AUDIO_VALIDATION_ERROR", message: string): AudioServiceResult<T> => ({ ok: false, error: { code, message } });

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Invalid image result"));
    reader.onerror = () => reject(new Error("Image preview could not be read"));
    reader.readAsDataURL(file);
  });
}

export const radioCoverService = {
  validate(file: File): AudioServiceResult<true> {
    if (!allowedTypes.has(file.type)) return fail("AUDIO_VALIDATION_ERROR", "Choose a PNG, JPG, WEBP, or GIF cover.");
    if (file.size <= 0 || file.size > maxCoverBytes) return fail("AUDIO_VALIDATION_ERROR", "Radio covers must be 5 MB or smaller.");
    return { ok: true, data: true };
  },
  async uploadCover(communityId: string, sessionId: string, file: File, options: RadioCoverUploadOptions = {}): Promise<AudioServiceResult<RadioCoverUpload>> {
    options.onProgress?.({ percent: 5, stage: "validating" });
    const validation = this.validate(file);
    if (!validation.ok) return validation;
    if (options.signal?.aborted) return fail("AUDIO_REQUEST_FAILED", "Upload canceled.");
    if (dataSourceService.getStatus().isMock) {
      try { const url = await readDataUrl(file); if (options.signal?.aborted) return fail("AUDIO_REQUEST_FAILED", "Upload canceled."); options.onProgress?.({ percent: 100, stage: "finalizing" }); return { ok: true, data: { url } }; }
      catch { return fail("AUDIO_REQUEST_FAILED", "Picom could not prepare this cover preview."); }
    }
    const client = getSupabaseClient();
    if (!client) return fail("AUDIO_BACKEND_UNAVAILABLE", "Radio cover storage is unavailable.");
    const extension = allowedTypes.get(file.type);
    const storagePath = "communities/" + communityId + "/radio/" + sessionId + "/covers/" + crypto.randomUUID() + "." + extension;
    options.onProgress?.({ percent: 30, stage: "uploading" });
    const upload = await client.storage.from("audio-covers").upload(storagePath, file, { cacheControl: "3600", contentType: file.type, upsert: false });
    if (upload.error) return fail("AUDIO_REQUEST_FAILED", "Picom could not upload the Radio cover.");
    if (options.signal?.aborted) { await client.storage.from("audio-covers").remove([storagePath]); return fail("AUDIO_REQUEST_FAILED", "Upload canceled."); }
    options.onProgress?.({ percent: 88, stage: "finalizing" });
    const signed = await client.storage.from("audio-covers").createSignedUrl(storagePath, 3600);
    if (signed.error || !signed.data?.signedUrl) {
      await client.storage.from("audio-covers").remove([storagePath]);
      return fail("AUDIO_REQUEST_FAILED", "Picom could not authorize the Radio cover preview.");
    }
    options.onProgress?.({ percent: 100, stage: "finalizing" });
    return { ok: true, data: { url: signed.data.signedUrl, storagePath } };
  },
  async getSignedCoverUrl(storagePath: string): Promise<AudioServiceResult<string>> {
    const client = getSupabaseClient();
    if (!client) return fail("AUDIO_BACKEND_UNAVAILABLE", "Radio cover storage is unavailable.");
    const signed = await client.storage.from("audio-covers").createSignedUrl(storagePath, 3600);
    return signed.error || !signed.data?.signedUrl ? fail("AUDIO_REQUEST_FAILED", "Picom could not authorize this Radio cover.") : { ok: true, data: signed.data.signedUrl };
  },
  async removeCover(storagePath: string): Promise<void> {
    if (dataSourceService.getStatus().isMock) return;
    const client = getSupabaseClient();
    if (client) await client.storage.from("audio-covers").remove([storagePath]);
  },
};
