/**
 * Hosted integration: publisher stream schedule reminders.
 *
 *   powershell -File scripts/with-supabase-cli-token.ps1 node scripts/publisher-schedule-reminder-integration.test.mjs --run
 */
import { randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const shouldRun = process.argv.includes("--run");
const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(rootDirectory, ".env.local");
const projectRef = "ufmtvqtsklqsmqxefbbs";
const results = [];

if (!shouldRun) {
  console.log("Publisher schedule reminder integration BLOCKED until --run");
  process.exit(0);
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/)
      .map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, "")];
      }),
  );
}

function requireValue(v, label) {
  if (!v?.trim()) throw new Error(`${label} missing`);
  return v.trim();
}

function getServiceRoleKey(ref) {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) return process.env.SUPABASE_SERVICE_ROLE_KEY.trim();
  const args = ["supabase", "projects", "api-keys", "--project-ref", ref, "--reveal", "--output", "json"];
  const output = process.platform === "win32"
    ? execFileSync("cmd.exe", ["/d", "/s", "/c", `npx ${args.join(" ")}`], {
      cwd: rootDirectory, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    })
    : execFileSync("npx", args, { cwd: rootDirectory, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const keys = JSON.parse(output);
  const serviceKey = keys.find((k) => /service.?role|secret/i.test(String(k.name ?? k.type ?? "")));
  return requireValue(serviceKey?.api_key ?? serviceKey?.key, "service role");
}

function record(caseId, status, detail = "") {
  results.push({ caseId, status, detail: String(detail).slice(0, 240) });
  console.log(`[${status}] ${caseId}${detail ? ` | ${String(detail).slice(0, 160)}` : ""}`);
}

const localEnv = parseEnvFile(envPath);
const supabaseUrl = requireValue(
  process.env.PICOM_LIVE_NOW_STAGING_URL ?? localEnv.VITE_SUPABASE_URL,
  "url",
).replace(/\/+$/, "");
if (!supabaseUrl.includes(`${projectRef}.supabase.co`)) throw new Error("non-staging url refused");
const anonKey = requireValue(process.env.PICOM_LIVE_NOW_STAGING_ANON_KEY ?? localEnv.VITE_SUPABASE_ANON_KEY, "anon");
const admin = createClient(supabaseUrl, getServiceRoleKey(projectRef), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const runId = randomUUID().slice(0, 8);
const password = `P!${randomBytes(18).toString("base64url")}9z`;
const cleanupUserIds = [];
const cleanupScheduleIds = [];

function client() {
  return createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function createActor(label) {
  const email = `picom-rem-${label}-${runId}@example.invalid`;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username: `rem_${label}_${runId}`.slice(0, 24) },
  });
  if (created.error || !created.data.user?.id) throw new Error(created.error?.message || "createUser failed");
  cleanupUserIds.push(created.data.user.id);
  const c = client();
  const signed = await c.auth.signInWithPassword({ email, password });
  if (signed.error) throw new Error(signed.error.message);
  return { id: created.data.user.id, client: c, email };
}

async function main() {
  const publisher = await createActor("pub");
  const viewer = await createActor("viewer");

  const scheduleInsert = await admin.from("publisher_stream_schedules").insert({
    owner_user_id: publisher.id,
    title: `Reminder smoke ${runId}`,
    description: "integration",
    category: "livestream",
    status: "scheduled",
    visibility: "public",
    scheduled_start_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    timezone: "UTC",
  }).select("id").single();
  if (scheduleInsert.error || !scheduleInsert.data?.id) {
    record("schedule_fixture", "FAIL", scheduleInsert.error?.message);
    throw new Error(scheduleInsert.error?.message || "schedule insert failed");
  }
  cleanupScheduleIds.push(scheduleInsert.data.id);
  record("schedule_fixture", "PASS", scheduleInsert.data.id);

  const enable = await viewer.client.rpc("set_publisher_stream_schedule_reminder", {
    target_schedule_id: scheduleInsert.data.id,
    target_enabled: true,
    target_minutes_before: 30,
    target_channel: "app",
  });
  record("reminder_enable", enable.error ? "FAIL" : "PASS", enable.error?.message ?? enable.data?.delivery_status);

  const list = await viewer.client.rpc("list_my_publisher_stream_schedule_reminders");
  const listed = Array.isArray(list.data) && list.data.some((r) => r.schedule_id === scheduleInsert.data.id && r.enabled);
  record("reminder_list", list.error || !listed ? "FAIL" : "PASS", list.error?.message ?? `count=${(list.data ?? []).length}`);

  const enableAgain = await viewer.client.rpc("set_publisher_stream_schedule_reminder", {
    target_schedule_id: scheduleInsert.data.id,
    target_enabled: true,
    target_minutes_before: 45,
    target_channel: "app",
  });
  const uniqueCheck = await admin
    .from("publisher_stream_schedule_reminders")
    .select("id", { count: "exact", head: true })
    .eq("user_id", viewer.id)
    .eq("schedule_id", scheduleInsert.data.id);
  record(
    "reminder_unique_upsert",
    enableAgain.error || uniqueCheck.count !== 1 ? "FAIL" : "PASS",
    `count=${uniqueCheck.count} minutes=${enableAgain.data?.minutes_before}`,
  );

  const moveStart = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
  const moved = await admin
    .from("publisher_stream_schedules")
    .update({ scheduled_start_at: moveStart })
    .eq("id", scheduleInsert.data.id)
    .select("id")
    .single();
  const afterMove = await admin
    .from("publisher_stream_schedule_reminders")
    .select("scheduled_at,delivery_status,enabled")
    .eq("user_id", viewer.id)
    .eq("schedule_id", scheduleInsert.data.id)
    .maybeSingle();
  record(
    "schedule_update_resync",
    moved.error || !afterMove.data?.enabled || afterMove.data.delivery_status !== "pending" ? "FAIL" : "PASS",
    afterMove.data?.delivery_status,
  );

  await admin
    .from("publisher_stream_schedule_reminders")
    .update({ scheduled_at: new Date(Date.now() - 60_000).toISOString(), delivery_status: "pending", enabled: true })
    .eq("user_id", viewer.id)
    .eq("schedule_id", scheduleInsert.data.id);

  const claim1 = await admin.rpc("claim_publisher_stream_schedule_reminders", {
    p_worker_id: `integration-${runId}`,
    p_batch_size: 10,
  });
  const claimed = Array.isArray(claim1.data) && claim1.data.some((r) => r.schedule_id === scheduleInsert.data.id);
  record("claim_outbox", claim1.error || !claimed ? "FAIL" : "PASS", claim1.error?.message ?? `claimed=${(claim1.data ?? []).length}`);

  const claim2 = await admin.rpc("claim_publisher_stream_schedule_reminders", {
    p_worker_id: `integration-${runId}-b`,
    p_batch_size: 10,
  });
  const reclaimedSame = Array.isArray(claim2.data) && claim2.data.some((r) => r.schedule_id === scheduleInsert.data.id);
  record("claim_idempotent", claim2.error || reclaimedSame ? "FAIL" : "PASS", `second_batch=${(claim2.data ?? []).length}`);

  const disable = await viewer.client.rpc("set_publisher_stream_schedule_reminder", {
    target_schedule_id: scheduleInsert.data.id,
    target_enabled: false,
    target_minutes_before: 30,
    target_channel: "app",
  });
  record("reminder_disable", disable.error || disable.data?.enabled ? "FAIL" : "PASS", disable.data?.delivery_status);

  const cancelSched = await admin
    .from("publisher_stream_schedules")
    .update({ status: "cancelled" })
    .eq("id", scheduleInsert.data.id);
  const afterCancel = await admin
    .from("publisher_stream_schedule_reminders")
    .select("enabled,delivery_status")
    .eq("schedule_id", scheduleInsert.data.id)
    .eq("user_id", viewer.id)
    .maybeSingle();
  record(
    "schedule_cancel_handling",
    cancelSched.error || afterCancel.data?.delivery_status !== "cancelled" ? "FAIL" : "PASS",
    afterCancel.data?.delivery_status,
  );

  const fail = results.filter((r) => r.status === "FAIL").length;
  const pass = results.filter((r) => r.status === "PASS").length;
  console.log(JSON.stringify({ pass, fail, results }, null, 2));
  process.exit(fail === 0 ? 0 : 1);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    for (const id of cleanupScheduleIds) {
      await admin.from("publisher_stream_schedules").delete().eq("id", id);
    }
    for (const id of cleanupUserIds) {
      await admin.auth.admin.deleteUser(id);
    }
  });
