import assert from "node:assert/strict";
import { cleanupOrphanedUploads, isOrphanedUpload } from "./lib/jobs/cleanup-orphaned-uploads.mjs";

const now = new Date("2026-07-05T00:00:00.000Z");
const gracePeriodMs = 24 * 60 * 60 * 1000;

assert.equal(isOrphanedUpload({ messageId: null, status: "pending", createdAt: "2026-07-03T00:00:00.000Z" }, { now, gracePeriodMs }), true);
assert.equal(isOrphanedUpload({ messageId: "message-1", status: "pending", createdAt: "2026-07-03T00:00:00.000Z" }, { now, gracePeriodMs }), false);
assert.equal(isOrphanedUpload({ messageId: null, status: "attached", createdAt: "2026-07-03T00:00:00.000Z" }, { now, gracePeriodMs }), false);
assert.equal(isOrphanedUpload({ messageId: null, status: "pending", createdAt: "2026-07-04T18:00:00.000Z" }, { now, gracePeriodMs }), false);

const attachments = [
  { id: "old-pending", messageId: null, storagePath: "pending/old.png", status: "pending", createdAt: "2026-07-03T00:00:00.000Z" },
  { id: "old-failed", messageId: null, storagePath: "pending/failed.png", status: "failed", createdAt: "2026-07-03T00:00:00.000Z" },
  { id: "attached-valid", messageId: "message-1", storagePath: "messages/valid.png", status: "attached", createdAt: "2026-07-03T00:00:00.000Z" },
  { id: "missing-path", messageId: null, storagePath: "", status: "pending", createdAt: "2026-07-03T00:00:00.000Z" },
];

const dryRun = await cleanupOrphanedUploads({ attachments, now, gracePeriodMs, dryRun: true, logger: { info() {} } });
assert.equal(dryRun.scanned, 4);
assert.equal(dryRun.orphaned, 3);
assert.equal(dryRun.deletedFiles, 0);
assert.equal(dryRun.errors.length, 0);

const deletedPaths = [];
const markedIds = [];
const applied = await cleanupOrphanedUploads({
  attachments: attachments.slice(0, 3),
  now,
  gracePeriodMs,
  dryRun: false,
  logger: { info() {} },
  deleteFile: async (storagePath) => {
    deletedPaths.push(storagePath);
  },
  markOrphaned: async (attachment) => {
    markedIds.push(attachment.id);
  },
});

assert.equal(applied.orphaned, 2);
assert.equal(applied.deletedFiles, 2);
assert.equal(applied.markedOrphaned, 2);
assert.deepEqual(deletedPaths, ["pending/old.png", "pending/failed.png"]);
assert.deepEqual(markedIds, ["old-pending", "old-failed"]);

const missingAdapter = await cleanupOrphanedUploads({ attachments: attachments.slice(0, 1), now, gracePeriodMs, dryRun: false, logger: { info() {} } });
assert.equal(missingAdapter.deletedFiles, 0);
assert.equal(missingAdapter.errors[0].reason, "DELETE_FILE_ADAPTER_MISSING");

console.log("OK orphaned uploads cleanup smoke test completed");
