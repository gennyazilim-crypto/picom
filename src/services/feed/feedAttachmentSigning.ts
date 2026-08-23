import type { FeedAttachment } from "./feedAttachmentModel";
import { MESSAGE_ATTACHMENTS_BUCKET } from "../uploadService";

export const FEED_ATTACHMENT_SIGNED_URL_TTL_SECONDS = 60 * 60;
export const FEED_ATTACHMENT_SIGN_BATCH_LIMIT = 40;

export type FeedAttachmentSigner = Readonly<{
  createSignedUrls: (
    paths: readonly string[],
    ttlSeconds: number,
  ) => Promise<ReadonlyArray<Readonly<{ path?: string | null; signedUrl?: string | null; error?: string | null }>>>;
  createSignedUrl: (
    path: string,
    ttlSeconds: number,
  ) => Promise<Readonly<{ signedUrl?: string | null } | null>>;
}>;

/** Reject paths that must never be sent to Storage signing APIs. */
export function isSafeMessageAttachmentStoragePath(path: string | null | undefined): boolean {
  if (!path || typeof path !== "string") return false;
  const trimmed = path.trim();
  if (!trimmed || trimmed.length > 1024) return false;
  if (trimmed.includes("..") || trimmed.includes("\\") || trimmed.startsWith("/")) return false;
  if (trimmed.includes("://")) return false;
  // Object keys are relative to the bucket; never accept foreign bucket prefixes as absolute URLs.
  if (/^[a-z0-9-]+:/i.test(trimmed) && !trimmed.startsWith("message-attachments/")) {
    // allow keys that start with uploader uuid folders without bucket name
  }
  if (/\0/.test(trimmed)) return false;
  return true;
}

export function collectPendingFeedStoragePaths(attachments: readonly FeedAttachment[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of attachments) {
    if (item.originalUrl) continue;
    const path = item.storagePath?.trim();
    if (!path || !isSafeMessageAttachmentStoragePath(path) || seen.has(path)) continue;
    seen.add(path);
    out.push(path);
    if (out.length >= FEED_ATTACHMENT_SIGN_BATCH_LIMIT) break;
  }
  return out;
}

export async function signFeedAttachmentPaths(
  signer: FeedAttachmentSigner,
  paths: readonly string[],
  options: Readonly<{ ttlSeconds?: number; signal?: AbortSignal }> = {},
): Promise<Map<string, string>> {
  const ttl = options.ttlSeconds ?? FEED_ATTACHMENT_SIGNED_URL_TTL_SECONDS;
  const signedByPath = new Map<string, string>();
  const unique = [...new Set(paths.map((path) => path.trim()).filter(isSafeMessageAttachmentStoragePath))]
    .slice(0, FEED_ATTACHMENT_SIGN_BATCH_LIMIT);
  if (!unique.length) return signedByPath;
  if (options.signal?.aborted) return signedByPath;

  try {
    const batch = await signer.createSignedUrls(unique, ttl);
    if (options.signal?.aborted) return signedByPath;
    for (const item of batch) {
      if (item.path && item.signedUrl && !item.error) signedByPath.set(item.path, item.signedUrl);
    }
  } catch {
    // Partial/total Storage failures must not throw into Feed page mapping.
  }

  const missing = unique.filter((path) => !signedByPath.has(path));
  if (!missing.length || options.signal?.aborted) return signedByPath;

  await Promise.all(missing.map(async (path) => {
    if (options.signal?.aborted) return;
    try {
      const single = await signer.createSignedUrl(path, ttl);
      if (single?.signedUrl) signedByPath.set(path, single.signedUrl);
    } catch {
      // leave unsigned; UI omits unavailable media
    }
  }));

  return signedByPath;
}

export function createSupabaseMessageAttachmentSigner(client: {
  storage: {
    from: (bucket: string) => {
      createSignedUrls: (paths: string[], ttl: number) => Promise<{
        data: Array<{ path: string | null; signedUrl: string | null; error: string | null }> | null;
      }>;
      createSignedUrl: (path: string, ttl: number) => Promise<{ data: { signedUrl: string } | null }>;
    };
  };
}): FeedAttachmentSigner {
  const bucket = client.storage.from(MESSAGE_ATTACHMENTS_BUCKET);
  return {
    async createSignedUrls(paths, ttlSeconds) {
      const result = await bucket.createSignedUrls([...paths], ttlSeconds);
      return (result.data ?? []).map((item) => ({
        path: item.path,
        signedUrl: item.signedUrl,
        error: item.error,
      }));
    },
    async createSignedUrl(path, ttlSeconds) {
      const result = await bucket.createSignedUrl(path, ttlSeconds);
      return result.data;
    },
  };
}

/** In-memory signed URL cache keyed by user + path; cleared on user switch / revoke. */
export class FeedSignedUrlCache {
  #userId: string | null = null;
  #byPath = new Map<string, Readonly<{ url: string; expiresAtMs: number }>>();

  setUser(userId: string | null): void {
    if (this.#userId === userId) return;
    this.#userId = userId;
    this.#byPath.clear();
  }

  clear(): void {
    this.#byPath.clear();
  }

  invalidatePath(path: string): void {
    this.#byPath.delete(path);
  }

  get(path: string, nowMs = Date.now()): string | null {
    const entry = this.#byPath.get(path);
    if (!entry) return null;
    if (entry.expiresAtMs <= nowMs) {
      this.#byPath.delete(path);
      return null;
    }
    return entry.url;
  }

  set(path: string, url: string, ttlSeconds = FEED_ATTACHMENT_SIGNED_URL_TTL_SECONDS, nowMs = Date.now()): void {
    // Refresh slightly early so Feed never serves near-expired URLs without re-sign.
    const skewMs = Math.min(60_000, Math.floor(ttlSeconds * 1000 * 0.05));
    this.#byPath.set(path, { url, expiresAtMs: nowMs + ttlSeconds * 1000 - skewMs });
  }

  applyKnown(signedByPath: ReadonlyMap<string, string>, ttlSeconds = FEED_ATTACHMENT_SIGNED_URL_TTL_SECONDS): void {
    for (const [path, url] of signedByPath) this.set(path, url, ttlSeconds);
  }

  mergeCached(paths: readonly string[], into: Map<string, string>, nowMs = Date.now()): string[] {
    const missing: string[] = [];
    for (const path of paths) {
      const cached = this.get(path, nowMs);
      if (cached) into.set(path, cached);
      else missing.push(path);
    }
    return missing;
  }
}

export const feedSignedUrlCache = new FeedSignedUrlCache();
