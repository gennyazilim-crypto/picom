export const JOB_TYPES = Object.freeze([
  "send_email_placeholder",
  "cleanup_expired_invites",
  "cleanup_orphaned_uploads",
  "notification_fanout",
  "audit_log_export_placeholder",
  "data_export_placeholder",
  "account_deletion_placeholder",
]);

export function isJobType(value) {
  return JOB_TYPES.includes(value);
}

function cloneSafePayload(payload) {
  if (payload === undefined || payload === null) {
    return {};
  }

  return JSON.parse(JSON.stringify(payload));
}

export function createInMemoryJobQueue(options = {}) {
  const queue = [];
  const logger = options.logger ?? console;
  let closed = false;
  let sequence = 0;

  if (process.env.NODE_ENV === "production" && process.env.PICOM_ALLOW_IN_MEMORY_JOBS_IN_PRODUCTION !== "true") {
    throw new Error("In-memory background jobs are development-only. Configure a production queue before enabling workers.");
  }

  function assertOpen() {
    if (closed) {
      throw new Error("Background job queue is shut down.");
    }
  }

  return {
    enqueue(type, payload = {}) {
      assertOpen();
      if (!isJobType(type)) {
        throw new Error(`Unsupported background job type: ${type}`);
      }

      const now = new Date().toISOString();
      const job = {
        id: `job_${Date.now()}_${++sequence}`,
        type,
        payload: cloneSafePayload(payload),
        status: "queued",
        attempts: 0,
        createdAt: now,
        updatedAt: now,
      };

      queue.push(job);
      logger.info?.("Background job queued", { jobId: job.id, type: job.type });
      return { ...job, payload: cloneSafePayload(job.payload) };
    },

    list() {
      return queue.map((job) => ({ ...job, payload: cloneSafePayload(job.payload) }));
    },

    async processNext(processors = {}) {
      assertOpen();
      const job = queue.find((candidate) => candidate.status === "queued");
      if (!job) {
        return null;
      }

      job.status = "running";
      job.attempts += 1;
      job.startedAt = new Date().toISOString();
      job.updatedAt = job.startedAt;

      try {
        const processor = processors[job.type];
        const result = typeof processor === "function"
          ? await processor({ ...job, payload: cloneSafePayload(job.payload) })
          : { ok: true, skipped: true, reason: "NO_PROCESSOR_PLACEHOLDER" };

        job.status = "completed";
        job.completedAt = new Date().toISOString();
        job.updatedAt = job.completedAt;
        job.result = cloneSafePayload(result);
        logger.info?.("Background job completed", { jobId: job.id, type: job.type });
        return { ...job, payload: cloneSafePayload(job.payload) };
      } catch (error) {
        job.status = "failed";
        job.failedAt = new Date().toISOString();
        job.updatedAt = job.failedAt;
        job.error = error instanceof Error ? error.message : "Unknown job error";
        logger.warn?.("Background job failed", { jobId: job.id, type: job.type, error: job.error });
        return { ...job, payload: cloneSafePayload(job.payload) };
      }
    },

    async drain(processors = {}) {
      const processed = [];
      while (queue.some((job) => job.status === "queued")) {
        const job = await this.processNext(processors);
        if (job) {
          processed.push(job);
        }
      }

      return processed;
    },

    shutdown() {
      closed = true;
      logger.info?.("Background job queue shut down", { queued: queue.filter((job) => job.status === "queued").length });
    },
  };
}
