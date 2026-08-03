/**
 * Hosted integration: live broadcaster notification preference modes.
 *
 *   powershell -File scripts/with-supabase-cli-token.ps1 node scripts/publisher-notification-pref-integration.test.mjs --run
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
const MODES = ["all_live", "scheduled_only", "important_only", "off"];

if (!shouldRun) {
  console.log("Publisher notification preference integration BLOCKED until --run");
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

function client() {
  return createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function createActor(label) {
  const email = `picom-pref-${label}-${runId}@example.invalid`;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username: `pref_${label}_${runId}`.slice(0, 24) },
  });
  if (created.error || !created.data.user?.id) throw new Error(created.error?.message || "createUser failed");
  cleanupUserIds.push(created.data.user.id);
  const c = client();
  const signed = await c.auth.signInWithPassword({ email, password });
  if (signed.error) throw new Error(signed.error.message);
  return { id: created.data.user.id, client: c };
}

async function main() {
  const broadcaster = await createActor("bc");
  const viewer = await createActor("vw");

  const selfDenied = await viewer.client.rpc("upsert_live_broadcaster_notification_pref", {
    target_broadcaster_id: viewer.id,
    target_mode: "all_live",
  });
  record("self_pref_denied", selfDenied.error ? "PASS" : "FAIL", selfDenied.error?.message ?? "unexpected ok");

  for (const mode of MODES) {
    const up = await viewer.client.rpc("upsert_live_broadcaster_notification_pref", {
      target_broadcaster_id: broadcaster.id,
      target_mode: mode,
    });
    const row = await viewer.client
      .from("live_broadcaster_notification_prefs")
      .select("mode")
      .eq("viewer_user_id", viewer.id)
      .eq("broadcaster_user_id", broadcaster.id)
      .maybeSingle();
    const ok = !up.error && row.data?.mode === mode;
    record(`mode_${mode}`, ok ? "PASS" : "FAIL", up.error?.message ?? row.data?.mode);
  }

  const legacy = await viewer.client.rpc("upsert_live_broadcaster_notification_pref", {
    target_broadcaster_id: broadcaster.id,
    target_mode: "all",
  });
  const legacyRow = await admin
    .from("live_broadcaster_notification_prefs")
    .select("mode")
    .eq("viewer_user_id", viewer.id)
    .eq("broadcaster_user_id", broadcaster.id)
    .maybeSingle();
  record(
    "legacy_all_alias",
    !legacy.error && legacyRow.data?.mode === "all_live" ? "PASS" : "FAIL",
    legacyRow.data?.mode,
  );

  const legacyImportant = await viewer.client.rpc("upsert_live_broadcaster_notification_pref", {
    target_broadcaster_id: broadcaster.id,
    target_mode: "community_member_only",
  });
  const importantRow = await admin
    .from("live_broadcaster_notification_prefs")
    .select("mode")
    .eq("viewer_user_id", viewer.id)
    .eq("broadcaster_user_id", broadcaster.id)
    .maybeSingle();
  record(
    "legacy_community_alias",
    !legacyImportant.error && importantRow.data?.mode === "important_only" ? "PASS" : "FAIL",
    importantRow.data?.mode,
  );

  const liveWorkspaceSrc = fs.readFileSync(
    path.join(rootDirectory, "src/components/live/LiveWorkspace.tsx"),
    "utf8",
  );
  const channelSrc = fs.readFileSync(
    path.join(rootDirectory, "src/components/live/BroadcasterChannelView.tsx"),
    "utf8",
  );
  record(
    "no_localstorage_pref",
    !/localStorage/.test(channelSrc) && !/localStorage.*notif/i.test(liveWorkspaceSrc) ? "PASS" : "FAIL",
  );
  record(
    "backend_upsert_wired",
    channelSrc.includes("setLiveBroadcasterNotificationMode") &&
      channelSrc.includes("all_live") &&
      channelSrc.includes("important_only")
      ? "PASS"
      : "FAIL",
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
    for (const id of cleanupUserIds) {
      await admin.from("live_broadcaster_notification_prefs").delete().eq("viewer_user_id", id);
      await admin.auth.admin.deleteUser(id);
    }
  });
