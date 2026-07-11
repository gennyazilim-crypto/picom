import { imageCacheService } from "./imageCacheService";
import { loggingService } from "./loggingService";
import { messageSendQueueService } from "./messageSendQueueService";

export type CacheSummary = Readonly<{
  estimatedUsageBytes: number | null;
  estimatedQuotaBytes: number | null;
  imageCacheEntries: number;
  imageCacheMaxEntries: number;
  recentLogEntries: number;
  messageCacheStatus: "not_persisted";
  offlineDataStatus: "memory_only_queue";
  pendingQueuedMessages: number;
  notes: string[];
}>;

export type CacheActionResult = Readonly<{
  ok: true;
  message: string;
  summary: CacheSummary;
}>;

async function estimateBrowserStorage(): Promise<Pick<CacheSummary, "estimatedUsageBytes" | "estimatedQuotaBytes">> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
    return { estimatedUsageBytes: null, estimatedQuotaBytes: null };
  }

  try {
    const estimate = await navigator.storage.estimate();
    return {
      estimatedUsageBytes: typeof estimate.usage === "number" ? estimate.usage : null,
      estimatedQuotaBytes: typeof estimate.quota === "number" ? estimate.quota : null,
    };
  } catch {
    return { estimatedUsageBytes: null, estimatedQuotaBytes: null };
  }
}

async function buildSummary(): Promise<CacheSummary> {
  const storage = await estimateBrowserStorage();
  const imageSummary = imageCacheService.getSummary();
  const queueSummary = messageSendQueueService.getGlobalSnapshot();

  return {
    ...storage,
    imageCacheEntries: imageSummary.entries,
    imageCacheMaxEntries: imageSummary.maxEntries,
    recentLogEntries: loggingService.getLogs().length,
    messageCacheStatus: "not_persisted",
    offlineDataStatus: "memory_only_queue",
    pendingQueuedMessages: queueSummary.totalPending,
    notes: [
      "Auth sessions are not cleared by cache actions.",
      "Drafts are not cleared by cache actions.",
      "Browser HTTP cache is managed by Electron/Chromium.",
      "Queued message content is kept in memory only and is not written to disk.",
      "Cache clearing preserves pending queued messages unless the user removes a message explicitly.",
    ],
  };
}

export const cacheManagementService = {
  getCacheSummary: buildSummary,

  async clearImageCache(): Promise<CacheActionResult> {
    imageCacheService.clearMemoryCache();
    return {
      ok: true,
      message: "Image cache metadata cleared. Browser-managed image cache is unchanged.",
      summary: await buildSummary(),
    };
  },

  async clearMessageCache(): Promise<CacheActionResult> {
    return {
      ok: true,
      message: "No persisted message cache exists, so no message, draft, auth session, or server data was removed.",
      summary: await buildSummary(),
    };
  },

  async clearLogs(): Promise<CacheActionResult> {
    loggingService.clearLogs();
    return {
      ok: true,
      message: "Recent redacted logs cleared.",
      summary: await buildSummary(),
    };
  },

  async clearAllNonEssentialCache(): Promise<CacheActionResult> {
    imageCacheService.clearMemoryCache();
    loggingService.clearLogs();
    return {
      ok: true,
      message: "Non-essential image metadata and redacted logs cleared. Auth sessions, drafts, queued messages, and server data were preserved.",
      summary: await buildSummary(),
    };
  },
};
