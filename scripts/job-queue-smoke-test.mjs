import assert from "node:assert/strict";
import { createInMemoryJobQueue, isJobType, JOB_TYPES } from "./lib/background-job-queue.mjs";

const logs = [];
const logger = {
  info(message, metadata) {
    logs.push({ level: "info", message, metadata });
  },
  warn(message, metadata) {
    logs.push({ level: "warn", message, metadata });
  },
};

assert.equal(isJobType("cleanup_expired_invites"), true);
assert.equal(isJobType("unknown_job"), false);
assert.ok(JOB_TYPES.includes("cleanup_orphaned_uploads"));

const queue = createInMemoryJobQueue({ logger });
const job = queue.enqueue("cleanup_expired_invites", { dryRun: true });
assert.equal(job.status, "queued");
assert.equal(queue.list().length, 1);

const processed = await queue.processNext({
  cleanup_expired_invites: async (currentJob) => ({
    ok: true,
    jobId: currentJob.id,
    scanned: 0,
    expired: 0,
  }),
});

assert.equal(processed.status, "completed");
assert.equal(processed.result.ok, true);
assert.equal(queue.list()[0].status, "completed");

queue.enqueue("cleanup_orphaned_uploads", { dryRun: true });
const drained = await queue.drain();
assert.equal(drained.length, 1);
assert.equal(drained[0].result.reason, "NO_PROCESSOR_PLACEHOLDER");

queue.shutdown();
assert.throws(() => queue.enqueue("notification_fanout", {}), /shut down/);
assert.ok(logs.some((entry) => entry.message === "Background job completed"));

console.log("OK background job queue smoke test completed");
