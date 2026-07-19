import { app, nativeImage, net, type NativeImage } from "electron";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { promises as fs } from "node:fs";
import type { IncomingCallToastPayload } from "./ipcPayloadValidation.cjs";

const CACHE_FOLDER = "notification-avatar-cache";
const IMAGE_SIZE = 256;
const MAX_SOURCE_BYTES = 5 * 1024 * 1024;
const MAX_SOURCE_DIMENSION = 8192;
const DOWNLOAD_TIMEOUT_MS = 4_000;
const NOTIFICATION_DEADLINE_MS = 1_200;
const CACHE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const CACHE_MAX_BYTES = 64 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/avif"]);

type AvatarSource = "cache" | "download" | "initials" | "app-icon";
export type PreparedNotificationAvatar = Readonly<{
  cachePath: string;
  dataUrl: string;
  image: NativeImage;
  source: AvatarSource;
  cacheKey: string;
}>;

const pendingWrites = new Map<string, Promise<PreparedNotificationAvatar>>();
let cleanupPromise: Promise<void> | null = null;

function logAvatarEvent(event: string, cacheKey: string, errorCode?: string): void {
  const details = JSON.stringify({ event, cacheKey, ...(errorCode ? { errorCode } : {}) });
  if (errorCode) console.warn(`[incoming-call-avatar] ${details}`);
  else if (!app.isPackaged) console.info(`[incoming-call-avatar] ${details}`);
}

function cacheDirectory(): string {
  return path.join(app.getPath("userData"), CACHE_FOLDER);
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

function safeCallerId(value: string): string {
  return value.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 64) || "caller";
}

function sourceCacheKey(payload: IncomingCallToastPayload): string {
  const source = payload.callerAvatarPath || payload.callerAvatarUrl || "no-avatar";
  const version = payload.callerAvatarUpdatedAt || "unversioned";
  return `${safeCallerId(payload.callerId)}-${hash(`${source}|${version}`)}`;
}

function initialsCacheKey(payload: IncomingCallToastPayload): string {
  return `${safeCallerId(payload.callerId)}-initials-${hash(payload.callerDisplayName)}`;
}

function pngPath(cacheKey: string): string {
  return path.join(cacheDirectory(), `${cacheKey}.png`);
}

async function existingAvatar(cacheKey: string, source: AvatarSource): Promise<PreparedNotificationAvatar | null> {
  const cachePath = pngPath(cacheKey);
  try {
    const buffer = await fs.readFile(cachePath);
    const image = nativeImage.createFromBuffer(buffer);
    if (image.isEmpty()) return null;
    return { cachePath, dataUrl: image.toDataURL(), image, source, cacheKey };
  } catch {
    return null;
  }
}

function approvedRemoteUrl(rawUrl: string): URL | null {
  try {
    const value = new URL(rawUrl);
    if (value.username || value.password) return null;
    const hostname = value.hostname.toLowerCase();
    const configured = (process.env.PICOM_APPROVED_CDN_HOSTS ?? "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean);
    const isSupabase = hostname.endsWith(".supabase.co") || hostname.endsWith(".supabase.in");
    const isConfigured = configured.includes(hostname);
    const isDevLocal = !app.isPackaged && ["127.0.0.1", "localhost"].includes(hostname);
    if (value.protocol !== "https:" && !(isDevLocal && value.protocol === "http:")) return null;
    return isSupabase || isConfigured || isDevLocal ? value : null;
  } catch {
    return null;
  }
}

async function atomicWrite(cachePath: string, buffer: Buffer): Promise<void> {
  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  const temporaryPath = `${cachePath}.${process.pid}.${randomUUID()}.tmp`;
  await fs.writeFile(temporaryPath, buffer, { mode: 0o600 });
  try {
    await fs.rename(temporaryPath, cachePath);
  } catch (error) {
    try {
      await fs.access(cachePath);
      await fs.rm(temporaryPath, { force: true });
    } catch {
      await fs.rm(temporaryPath, { force: true });
      throw error;
    }
  }
}

function normalizeImage(buffer: Buffer): Buffer {
  const decoded = nativeImage.createFromBuffer(buffer);
  if (decoded.isEmpty()) throw new Error("AVATAR_DECODE_FAILED");
  const size = decoded.getSize();
  if (
    size.width < 1 ||
    size.height < 1 ||
    size.width > MAX_SOURCE_DIMENSION ||
    size.height > MAX_SOURCE_DIMENSION
  ) {
    throw new Error("AVATAR_DIMENSIONS_INVALID");
  }
  const square = Math.min(size.width, size.height);
  const cropped = decoded.crop({
    x: Math.floor((size.width - square) / 2),
    y: Math.floor((size.height - square) / 2),
    width: square,
    height: square,
  });
  return cropped.resize({ width: IMAGE_SIZE, height: IMAGE_SIZE, quality: "best" }).toPNG();
}

async function readBoundedResponse(response: Response): Promise<Buffer> {
  if (!response.body) throw new Error("AVATAR_BODY_MISSING");
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_SOURCE_BYTES) {
      await reader.cancel("AVATAR_TOO_LARGE");
      throw new Error("AVATAR_TOO_LARGE");
    }
    chunks.push(Buffer.from(value));
  }
  if (total < 1) throw new Error("AVATAR_BODY_EMPTY");
  return Buffer.concat(chunks, total);
}

async function downloadAndCache(payload: IncomingCallToastPayload, cacheKey: string): Promise<PreparedNotificationAvatar> {
  const approvedUrl = payload.callerAvatarUrl ? approvedRemoteUrl(payload.callerAvatarUrl) : null;
  if (!approvedUrl) throw new Error("AVATAR_URL_NOT_APPROVED");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const response = await net.fetch(approvedUrl.toString(), {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { Accept: "image/png,image/jpeg,image/webp,image/avif" },
    });
    if (!response.ok) throw new Error("AVATAR_DOWNLOAD_FAILED");
    if (!approvedRemoteUrl(response.url)) throw new Error("AVATAR_REDIRECT_NOT_APPROVED");
    const mimeType = (response.headers.get("content-type") ?? "").split(";", 1)[0].trim().toLowerCase();
    if (!ACCEPTED_MIME_TYPES.has(mimeType)) throw new Error("AVATAR_MIME_REJECTED");
    const contentLength = Number(response.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_SOURCE_BYTES) {
      throw new Error("AVATAR_TOO_LARGE");
    }
    const source = await readBoundedResponse(response);
    const png = normalizeImage(source);
    const cachePath = pngPath(cacheKey);
    await atomicWrite(cachePath, png);
    const image = nativeImage.createFromBuffer(png);
    return { cachePath, dataUrl: image.toDataURL(), image, source: "download", cacheKey };
  } finally {
    clearTimeout(timeout);
  }
}

function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words[words.length - 1][0]}` : words[0]?.slice(0, 2) || "P")
    .toLocaleUpperCase()
    .replace(/[^\p{L}\p{N}]/gu, "")
    .slice(0, 2) || "P";
}

async function initialsAvatar(payload: IncomingCallToastPayload): Promise<PreparedNotificationAvatar> {
  const cacheKey = initialsCacheKey(payload);
  const cached = await existingAvatar(cacheKey, "initials");
  if (cached) return cached;
  const hue = Number.parseInt(hash(payload.callerId).slice(0, 4), 16) % 360;
  const initials = initialsFor(payload.callerDisplayName);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${IMAGE_SIZE}" height="${IMAGE_SIZE}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="hsl(${hue} 62% 45%)"/><stop offset="1" stop-color="hsl(${(hue + 45) % 360} 58% 34%)"/></linearGradient></defs><rect width="256" height="256" rx="128" fill="url(#g)"/><text x="128" y="145" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif" font-size="92" font-weight="700" fill="white">${initials}</text></svg>`;
  const image = nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`);
  if (image.isEmpty()) throw new Error("INITIALS_AVATAR_FAILED");
  const png = image.resize({ width: IMAGE_SIZE, height: IMAGE_SIZE, quality: "best" }).toPNG();
  const cachePath = pngPath(cacheKey);
  await atomicWrite(cachePath, png);
  const normalized = nativeImage.createFromBuffer(png);
  return { cachePath, dataUrl: normalized.toDataURL(), image: normalized, source: "initials", cacheKey };
}

async function appIconAvatar(appIconPath: string, payload: IncomingCallToastPayload): Promise<PreparedNotificationAvatar> {
  const cacheKey = `${safeCallerId(payload.callerId)}-app-icon`;
  const image = nativeImage.createFromPath(appIconPath).resize({ width: IMAGE_SIZE, height: IMAGE_SIZE, quality: "best" });
  if (image.isEmpty()) throw new Error("APP_ICON_FALLBACK_FAILED");
  const png = image.toPNG();
  const cachePath = pngPath(cacheKey);
  await atomicWrite(cachePath, png);
  return { cachePath, dataUrl: image.toDataURL(), image, source: "app-icon", cacheKey };
}

async function cleanupCache(): Promise<void> {
  const directory = cacheDirectory();
  try {
    const names = await fs.readdir(directory);
    const entries = await Promise.all(names.filter((name) => name.endsWith(".png")).map(async (name) => {
      const filePath = path.join(directory, name);
      const stat = await fs.stat(filePath);
      return { filePath, size: stat.size, mtimeMs: stat.mtimeMs };
    }));
    const now = Date.now();
    for (const entry of entries.filter((item) => now - item.mtimeMs > CACHE_MAX_AGE_MS)) {
      await fs.rm(entry.filePath, { force: true });
    }
    const current = entries.filter((item) => now - item.mtimeMs <= CACHE_MAX_AGE_MS).sort((a, b) => b.mtimeMs - a.mtimeMs);
    let total = 0;
    for (const entry of current) {
      total += entry.size;
      if (total > CACHE_MAX_BYTES) await fs.rm(entry.filePath, { force: true });
    }
  } catch {
    // Cache cleanup must never block an incoming call surface.
  }
}

export async function prepareNotificationAvatar(
  payload: IncomingCallToastPayload,
  appIconPath: string,
): Promise<PreparedNotificationAvatar> {
  cleanupPromise ??= cleanupCache();
  void cleanupPromise;
  const cacheKey = sourceCacheKey(payload);
  const cached = await existingAvatar(cacheKey, "cache");
  if (cached) {
    logAvatarEvent("cache_hit", cacheKey);
    return cached;
  }

  let remote = pendingWrites.get(cacheKey);
  if (!remote) {
    remote = downloadAndCache(payload, cacheKey).finally(() => pendingWrites.delete(cacheKey));
    pendingWrites.set(cacheKey, remote);
  }

  const deadline = new Promise<null>((resolve) => setTimeout(() => resolve(null), NOTIFICATION_DEADLINE_MS));
  const downloaded = await Promise.race([
    remote.catch((error: unknown) => {
      const rawCode = error instanceof Error ? error.message : "UNKNOWN";
      const errorCode = /^[A-Z0-9_]+$/.test(rawCode) ? rawCode : error instanceof Error ? error.name : "UNKNOWN";
      logAvatarEvent("download_failed", cacheKey, errorCode);
      return null;
    }),
    deadline,
  ]);
  if (downloaded) {
    logAvatarEvent("download_ready", cacheKey);
    return downloaded;
  }
  try {
    const fallback = await initialsAvatar(payload);
    logAvatarEvent("initials_fallback", fallback.cacheKey);
    return fallback;
  } catch {
    const fallback = await appIconAvatar(appIconPath, payload);
    logAvatarEvent("app_icon_fallback", fallback.cacheKey);
    return fallback;
  }
}
