/**
 * Publisher media worker — claims media jobs (probe/thumbnail/clip) via SKIP LOCKED.
 *
 * Runtime is fail-closed without object storage + ffmpeg. Jobs remain queued until
 * infrastructure is provisioned. Do not shell-interpolate payload fields.
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional: PUBLISHER_MEDIA_POLL_MS, PUBLISHER_MEDIA_BATCH_SIZE, PICOM_FFMPEG_PATH
 */
import os from "node:os";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const required = (name) => {
  const value = String(process.env[name] ?? "").trim();
  if (!value) throw new Error(`PUBLISHER_MEDIA_CONFIG_MISSING:${name}`);
  return value;
};

const config = Object.freeze({
  supabaseUrl: required("SUPABASE_URL"),
  serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  pollMs: Math.min(Math.max(Number(process.env.PUBLISHER_MEDIA_POLL_MS ?? 20000), 5000), 120000),
  batchSize: Math.min(Math.max(Number(process.env.PUBLISHER_MEDIA_BATCH_SIZE ?? 5), 1), 25),
  ffmpegPath: String(process.env.PICOM_FFMPEG_PATH ?? "").trim(),
});

const workerId = `publisher-media:${os.hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`;
const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let shuttingDown = false;
let processing = false;

async function processJob(job) {
  // Structured args only — never interpolate user/title/path fragments into a shell.
  if (!config.ffmpegPath) {
    await supabase.rpc("complete_publisher_media_job", {
      target_job_id: job.id,
      target_success: false,
      target_error: "FFMPEG_NOT_CONFIGURED",
      target_result: {},
    });
    return;
  }
  // Clip/probe execution requires local object fetch + ffmpeg; blocked until storage egress is wired.
  await supabase.rpc("complete_publisher_media_job", {
    target_job_id: job.id,
    target_success: false,
    target_error: "MEDIA_WORKER_INFRASTRUCTURE_PENDING",
    target_result: { job_type: job.job_type },
  });
}

async function tick() {
  if (shuttingDown || processing) return;
  processing = true;
  try {
    const { data, error } = await supabase.rpc("claim_publisher_media_jobs", {
      worker_id: workerId,
      batch_size: config.batchSize,
    });
    if (error || !Array.isArray(data) || data.length === 0) return;
    for (const job of data) {
      await processJob(job);
    }
  } finally {
    processing = false;
  }
}

process.on("SIGINT", () => {
  shuttingDown = true;
});
process.on("SIGTERM", () => {
  shuttingDown = true;
});

console.log(JSON.stringify({ msg: "publisher-media-worker_started", workerId, pollMs: config.pollMs }));
setInterval(() => {
  void tick();
}, config.pollMs);
void tick();
