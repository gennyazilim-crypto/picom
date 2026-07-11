import type { PodcastEpisode } from "../../types/audio";
import { dataSourceService } from "../dataSourceService";
import { getSupabaseClient } from "../supabase/supabaseClient";
import { audioDataSource, type CreatePodcastDraftInput, type UpdatePodcastMetadataInput } from "./audioDataSource";

export type PodcastUploadKind = "cover" | "audio";
export type PodcastUploadProgress = Readonly<{ stage: "validating" | "uploading" | "finalizing" | "complete"; percent: number; label: string }>;
export type PodcastPublishingResult<T> = Readonly<{ ok: true; data: T }> | Readonly<{ ok: false; error: string; code?: "VALIDATION" | "CANCELED" | "UPLOAD" | "PERMISSION" }>;

const AUDIO_TYPES = new Map<string, string>([["audio/mpeg", "mp3"], ["audio/mp4", "m4a"], ["audio/ogg", "ogg"], ["audio/wav", "wav"], ["audio/webm", "webm"]]);
const COVER_TYPES = new Map<string, string>([["image/png", "png"], ["image/jpeg", "jpg"], ["image/webp", "webp"], ["image/gif", "gif"]]);
const MAX_AUDIO_BYTES = 100 * 1024 * 1024;
const MAX_COVER_BYTES = 5 * 1024 * 1024;

function failure(error: string, code?: "VALIDATION" | "CANCELED" | "UPLOAD" | "PERMISSION"): PodcastPublishingResult<never> { return { ok: false, error, code }; }
function aborted(signal?: AbortSignal): boolean { return signal?.aborted === true; }
function report(callback: ((progress: PodcastUploadProgress) => void) | undefined, stage: PodcastUploadProgress["stage"], percent: number, label: string): void { callback?.({ stage, percent, label }); }

async function readAudioDuration(file: File, signal?: AbortSignal): Promise<number> {
  if (typeof document === "undefined" || typeof URL === "undefined") return 0;
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = document.createElement("audio");
    const finish = (value: number) => { globalThis.clearTimeout(timeout); signal?.removeEventListener("abort", cancel); audio.removeAttribute("src"); URL.revokeObjectURL(url); resolve(value); };
    const cancel = () => finish(0);
    const timeout = globalThis.setTimeout(() => finish(0), 8000);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => finish(Number.isFinite(audio.duration) ? Math.max(0, Math.round(audio.duration)) : 0);
    audio.onerror = () => finish(0);
    signal?.addEventListener("abort", cancel, { once: true });
    audio.src = url;
  });
}

function validateFile(kind: PodcastUploadKind, file: File): PodcastPublishingResult<Readonly<{ extension: string }>> {
  const allowed = kind === "audio" ? AUDIO_TYPES : COVER_TYPES;
  const extension = allowed.get(file.type);
  if (!extension) return failure(kind === "audio" ? "Use MP3, M4A, Ogg, WAV, or WebM audio." : "Use PNG, JPEG, WebP, or GIF cover artwork.", "VALIDATION");
  const limit = kind === "audio" ? MAX_AUDIO_BYTES : MAX_COVER_BYTES;
  if (file.size <= 0 || file.size > limit) return failure(kind === "audio" ? "Podcast audio must be between 1 byte and 100 MiB." : "Cover artwork must be between 1 byte and 5 MiB.", "VALIDATION");
  return { ok: true, data: { extension } };
}

export const podcastPublishingService = {
  createDraft: (input: CreatePodcastDraftInput) => audioDataSource.createPodcastDraft(input),
  updateMetadata: (id: string, input: UpdatePodcastMetadataInput) => audioDataSource.updatePodcastMetadata(id, input),
  publish: (id: string) => audioDataSource.publishPodcastEpisode(id),
  unpublish: (id: string) => audioDataSource.unpublishPodcastEpisode(id),
  archive: (id: string) => audioDataSource.archivePodcastEpisode(id),

  async uploadMedia(input: { episode: PodcastEpisode; kind: PodcastUploadKind; file: File; signal?: AbortSignal; onProgress?: (progress: PodcastUploadProgress) => void }): Promise<PodcastPublishingResult<PodcastEpisode>> {
    report(input.onProgress, "validating", 8, "Validating file");
    const validation = validateFile(input.kind, input.file); if (!validation.ok) return validation;
    if (aborted(input.signal)) return failure("Upload canceled.", "CANCELED");
    const duration = input.kind === "audio" ? await readAudioDuration(input.file, input.signal) : undefined;
    if (input.kind === "audio" && (!duration || duration <= 0)) return failure("Picom could not read valid audio duration metadata.", "VALIDATION");
    if (aborted(input.signal)) return failure("Upload canceled.", "CANCELED");
    report(input.onProgress, "uploading", 35, "Uploading private media");

    if (dataSourceService.getStatus().isMock) {
      await new Promise((resolve) => globalThis.setTimeout(resolve, 320));
      if (aborted(input.signal)) return failure("Upload canceled.", "CANCELED");
      const url = URL.createObjectURL(input.file);
      const updated = await audioDataSource.updatePodcastMedia(input.episode.id, { kind: input.kind, url, storagePath: "mock/" + input.episode.id + "/" + input.kind + "/" + crypto.randomUUID() + "." + validation.data.extension, mimeType: input.kind === "audio" ? input.file.type as PodcastEpisode["audioMimeType"] : undefined, sizeBytes: input.file.size, durationSeconds: duration });
      if (!updated.ok) { URL.revokeObjectURL(url); return failure(updated.error.message, "UPLOAD"); }
      report(input.onProgress, "complete", 100, "Upload complete"); return updated;
    }

    const client = getSupabaseClient(); if (!client) return failure("Podcast Storage is unavailable.", "UPLOAD");
    const bucket = input.kind === "audio" ? "podcast-audio" : "audio-covers";
    const folder = input.kind === "audio" ? "audio" : "covers";
    const storagePath = "communities/" + input.episode.communityId + "/podcasts/" + input.episode.id + "/" + folder + "/" + crypto.randomUUID() + "." + validation.data.extension;
    const upload = await client.storage.from(bucket).upload(storagePath, input.file, { contentType: input.file.type, upsert: false });
    if (upload.error) return failure("Picom could not upload this private Podcast file.", "UPLOAD");
    if (aborted(input.signal)) { await client.storage.from(bucket).remove([storagePath]); return failure("Upload canceled.", "CANCELED"); }
    report(input.onProgress, "finalizing", 82, "Securing media metadata");
    const signed = await client.storage.from(bucket).createSignedUrl(storagePath, 3600);
    if (signed.error || !signed.data?.signedUrl) { await client.storage.from(bucket).remove([storagePath]); return failure("Picom could not create a private media preview.", "UPLOAD"); }
    const updated = await audioDataSource.updatePodcastMedia(input.episode.id, { kind: input.kind, url: signed.data.signedUrl, storagePath, mimeType: input.kind === "audio" ? input.file.type as PodcastEpisode["audioMimeType"] : undefined, sizeBytes: input.file.size, durationSeconds: duration });
    if (!updated.ok) { await client.storage.from(bucket).remove([storagePath]); return failure(updated.error.message, "UPLOAD"); }
    const previousPath = input.kind === "audio" ? input.episode.audioStoragePath : input.episode.coverStoragePath;
    if (previousPath && previousPath !== storagePath) await client.storage.from(bucket).remove([previousPath]);
    report(input.onProgress, "complete", 100, "Upload complete"); return { ok: true, data: updated.data };
  },

  async deleteEpisode(episode: PodcastEpisode): Promise<PodcastPublishingResult<boolean>> {
    if (episode.status === "published") return failure("Unpublish or archive this episode before deleting it.", "VALIDATION");
    const client = dataSourceService.getStatus().isSupabase ? getSupabaseClient() : null;
    if (client) {
      if (episode.audioStoragePath) { const removed = await client.storage.from("podcast-audio").remove([episode.audioStoragePath]); if (removed.error) return failure("Podcast audio cleanup failed; the episode was not deleted.", "UPLOAD"); }
      if (episode.coverStoragePath) { const removed = await client.storage.from("audio-covers").remove([episode.coverStoragePath]); if (removed.error) return failure("Podcast cover cleanup failed; the episode was not deleted.", "UPLOAD"); }
    }
    const deleted = await audioDataSource.deletePodcastEpisode(episode.id);
    return deleted.ok ? { ok: true, data: deleted.data } : failure(deleted.error.message, "PERMISSION");
  },
};
