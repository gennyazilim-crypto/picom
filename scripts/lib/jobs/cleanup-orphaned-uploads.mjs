const DEFAULT_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;
const ORPHAN_CANDIDATE_STATUSES = new Set(["pending", "failed"]);

export function isOrphanedUpload(attachment, options = {}) {
  const now = options.now ?? new Date();
  const gracePeriodMs = options.gracePeriodMs ?? DEFAULT_GRACE_PERIOD_MS;

  if (!attachment || attachment.messageId) {
    return false;
  }

  if (!ORPHAN_CANDIDATE_STATUSES.has(attachment.status)) {
    return false;
  }

  const createdAt = new Date(attachment.createdAt);
  if (Number.isNaN(createdAt.getTime())) {
    return false;
  }

  return now.getTime() - createdAt.getTime() >= gracePeriodMs;
}

export async function cleanupOrphanedUploads(options = {}) {
  const {
    attachments = [],
    now = new Date(),
    gracePeriodMs = DEFAULT_GRACE_PERIOD_MS,
    dryRun = true,
    deleteFile,
    markOrphaned,
    logger = console,
  } = options;

  const summary = {
    ok: true,
    dryRun,
    gracePeriodMs,
    scanned: attachments.length,
    orphaned: 0,
    deletedFiles: 0,
    markedOrphaned: 0,
    errors: [],
  };

  for (const attachment of attachments) {
    if (!isOrphanedUpload(attachment, { now, gracePeriodMs })) {
      continue;
    }

    summary.orphaned += 1;

    if (dryRun) {
      continue;
    }

    if (!attachment.storagePath) {
      summary.errors.push({
        attachmentId: attachment.id ?? "unknown",
        reason: "STORAGE_PATH_MISSING",
      });
      continue;
    }

    if (typeof deleteFile !== "function") {
      summary.errors.push({
        attachmentId: attachment.id ?? "unknown",
        reason: "DELETE_FILE_ADAPTER_MISSING",
      });
      continue;
    }

    try {
      await deleteFile(attachment.storagePath, attachment);
      summary.deletedFiles += 1;

      if (typeof markOrphaned === "function") {
        await markOrphaned(attachment, now);
        summary.markedOrphaned += 1;
      }
    } catch (error) {
      summary.errors.push({
        attachmentId: attachment.id ?? "unknown",
        reason: error instanceof Error ? error.message : "UNKNOWN_UPLOAD_CLEANUP_ERROR",
      });
    }
  }

  logger.info?.("Orphaned upload cleanup summary", {
    dryRun: summary.dryRun,
    scanned: summary.scanned,
    orphaned: summary.orphaned,
    deletedFiles: summary.deletedFiles,
    markedOrphaned: summary.markedOrphaned,
    errors: summary.errors.length,
  });

  return summary;
}
