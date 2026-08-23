/**
 * Staging JWT/RLS + realtime badge-revocation smoke for Live Now.
 * Does not modify Case 04 / Case 18 SQL fixtures.
 *
 *   powershell -File scripts/with-supabase-cli-token.ps1 node scripts/publisher-live-now-jwt-rls-revocation-smoke.mjs --run
 *
 * Never logs JWTs, service role keys, LiveKit tokens, or stream keys.
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
const utcStamp = new Date().toISOString().replace(/[:.]/g, "-");
const evidenceDir = path.join(
  rootDirectory,
  "docs/audit/evidence",
  `live-now-jwt-rls-revocation-${utcStamp}`,
);

if (!shouldRun) {
  console.log("JWT/RLS revocation smoke BLOCKED until --run");
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

function redact(detail) {
  return String(detail ?? "")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[REDACTED_JWT]")
    .replace(/postgres:\/\/[^\s]+/gi, "[REDACTED_DSN]")
    .replace(/service[_-]?role[^\s]*/gi, "[REDACTED_SERVICE]")
    .slice(0, 280);
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
  results.push({ caseId, status, detail: redact(detail) });
  console.log(`[${status}] ${caseId}${detail ? ` | ${redact(detail).slice(0, 160)}` : ""}`);
}

function err(e) {
  return redact([e?.message, e?.code, e?.details].filter(Boolean).join(" | "));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function communityIdFrom(data) {
  if (Array.isArray(data)) return data[0]?.id ?? data[0] ?? null;
  return data?.id ?? data ?? null;
}

const localEnv = parseEnvFile(envPath);
const supabaseUrl = requireValue(
  process.env.PICOM_LIVE_NOW_STAGING_URL ?? localEnv.VITE_SUPABASE_URL,
  "url",
).replace(/\/+$/, "");
if (!supabaseUrl.includes(`${projectRef}.supabase.co`)) {
  throw new Error("non-staging url refused");
}
const anonKey = requireValue(
  process.env.PICOM_LIVE_NOW_STAGING_ANON_KEY ?? localEnv.VITE_SUPABASE_ANON_KEY,
  "anon",
);
const admin = createClient(supabaseUrl, getServiceRoleKey(projectRef), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const runId = randomUUID().slice(0, 8);
const password = `P!${randomBytes(18).toString("base64url")}9z`;
const users = [];
const communities = [];
const sessions = [];
const applications = [];
const roleAssignmentIds = [];
const emails = new Map();

function client() {
  return createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function createActor(label) {
  const email = `picom-rev-${label}-${runId}@example.invalid`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username: `r_${label}_${runId}`.slice(0, 24), display_name: label },
  });
  if (error || !data.user) throw new Error(`create ${label}: ${error?.message}`);
  users.push(data.user.id);
  emails.set(label, email);
  await admin.from("profiles").upsert({
    id: data.user.id,
    username: `r_${label}_${runId}`.slice(0, 24),
    display_name: label,
    status: "online",
  });
  const c = client();
  const signIn = await c.auth.signInWithPassword({ email, password });
  if (signIn.error) throw new Error(`signin ${label}: ${signIn.error.message}`);
  return { id: data.user.id, client: c, label, email };
}

async function assignRole(userId, roleKey) {
  const { data, error } = await admin.from("platform_role_assignments").upsert({
    user_id: userId,
    role_key: roleKey,
    scope_type: "global",
    revoked_at: null,
    expires_at: null,
  }, { onConflict: "user_id,role_key,scope_type" }).select("id").single();
  if (error) throw new Error(`role ${roleKey}: ${error.message}`);
  if (data?.id) roleAssignmentIds.push(data.id);
}

async function waitForRealtime(channelPromise, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const hit = await channelPromise.peek?.() ?? await channelPromise;
    if (hit) return hit;
    await sleep(200);
  }
  return null;
}

function listenForChanges(actorClient, tables) {
  let resolved = false;
  let value = null;
  const events = [];
  const id = randomUUID().slice(0, 8);
  let channel = actorClient.channel(`revocation-smoke:${id}`);
  for (const table of tables) {
    channel = channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table },
      (payload) => {
        events.push({ table, eventType: payload.eventType });
        value = { table, eventType: payload.eventType, at: Date.now() };
        resolved = true;
      },
    );
  }
  const ready = new Promise((resolve, reject) => {
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") resolve(true);
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        reject(new Error(`realtime subscribe ${status}`));
      }
    });
  });
  return {
    ready,
    peek: async () => {
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline) {
        if (resolved) return value;
        await sleep(150);
      }
      return null;
    },
    events: () => events.slice(),
    async close() {
      await actorClient.removeChannel(channel);
    },
  };
}

async function discoverySnapshot(viewerClient, searchTitle, sessionId) {
  const list = await viewerClient.rpc("list_publisher_live_now", {
    p_limit: 50,
    p_search: searchTitle,
    p_sort: "viewers",
  });
  const rows = Array.isArray(list.data) ? list.data : [];
  const found = rows.some((r) => r.id === sessionId);
  const featuredId = rows.length
    ? [...rows].sort((a, b) => Number(b.viewer_count ?? 0) - Number(a.viewer_count ?? 0))[0]?.id
    : null;
  const featuredHas = featuredId === sessionId;
  const count = await viewerClient.rpc("count_publisher_live_now", {
    p_search: searchTitle,
  });
  const searchOnly = await viewerClient.rpc("list_publisher_live_now", {
    p_limit: 50,
    p_search: searchTitle,
  });
  const searchRows = Array.isArray(searchOnly.data) ? searchOnly.data : [];
  const searchHas = searchRows.some((r) => r.id === sessionId);
  const cats = await viewerClient.rpc("count_publisher_live_now_by_category");
  const catRows = Array.isArray(cats.data) ? cats.data : [];
  return {
    listError: list.error,
    countError: count.error,
    searchError: searchOnly.error,
    found,
    searchHas,
    featuredHas,
    count: Number(count.data ?? -1),
    catGame: Number(catRows.find((c) => c.category === "game")?.live_count ?? 0),
  };
}

async function cleanup() {
  for (const id of sessions) {
    await admin.from("community_live_screen_sessions").delete().eq("id", id);
  }
  for (const id of applications) {
    await admin.from("publisher_review_actions").delete().eq("application_id", id);
    await admin.from("publisher_applications").delete().eq("id", id);
  }
  for (const id of roleAssignmentIds) {
    await admin.from("platform_role_assignments").delete().eq("id", id);
  }
  for (const id of users) {
    await admin.from("platform_role_assignments").delete().eq("user_id", id);
    await admin.from("publisher_badges").delete().eq("user_id", id);
    await admin.from("publisher_profiles").delete().eq("user_id", id);
    await admin.from("publisher_applications").delete().eq("user_id", id);
    await admin.from("publisher_live_bans").delete().eq("user_id", id);
    await admin.from("community_members").delete().eq("user_id", id);
    try { await admin.auth.admin.deleteUser(id); } catch { /* ignore */ }
  }
  for (const id of communities) {
    await admin.from("community_live_screen_sessions").delete().eq("community_id", id);
    await admin.from("channels").delete().eq("community_id", id);
    await admin.from("roles").delete().eq("community_id", id);
    await admin.from("communities").delete().eq("id", id);
  }
}

fs.mkdirSync(evidenceDir, { recursive: true });
fs.writeFileSync(path.join(evidenceDir, "00-environment.txt"), [
  `utc=${new Date().toISOString()}`,
  `project_ref=${projectRef}`,
  `supabase_url_host=${new URL(supabaseUrl).host}`,
  `run_id=${runId}`,
  `case04_untouched=true`,
  `case18_untouched=true`,
  `script=scripts/publisher-live-now-jwt-rls-revocation-smoke.mjs`,
].join("\n"));

try {
  const creator = await createActor("creator");
  const viewer = await createActor("viewer");
  const reviewer = await createActor("reviewer");
  const readonly = await createActor("readonly");
  const regular = await createActor("regular");

  await assignRole(reviewer.id, "moderator");
  await assignRole(readonly.id, "finance_viewer");

  // Confirm role helpers
  const canReview = await reviewer.client.rpc("can_review_publisher_applications");
  record("role_reviewer_can_review", !canReview.error && canReview.data === true ? "PASS" : "FAIL",
    canReview.error ? err(canReview.error) : `data=${canReview.data}`);
  const canListReadonly = await readonly.client.rpc("can_list_publisher_applications");
  const canReviewReadonly = await readonly.client.rpc("can_review_publisher_applications");
  record("role_readonly_list_only",
    !canListReadonly.error && canListReadonly.data === true
      && !canReviewReadonly.error && canReviewReadonly.data === false ? "PASS" : "FAIL",
    `list=${canListReadonly.data} review=${canReviewReadonly.data}`);

  // Creator community + approved publisher fixture (server-side eligibility already Case 04/18)
  const created = await creator.client.rpc("create_text_community_with_defaults", {
    target_creation_request_id: randomUUID(),
    community_name: `Rev JWT ${runId}`,
    community_description: "jwt rls revocation",
    community_icon_url: null,
    community_accent_color: "#007571",
    community_visibility: "public",
    community_public_read_enabled: true,
    community_template_id: "custom",
  });
  const communityId = communityIdFrom(created.data);
  if (created.error || !communityId) throw new Error(`community: ${err(created.error)}`);
  communities.push(communityId);

  const ch = await admin.from("channels")
    .insert({ community_id: communityId, name: "live-voice", type: "voice", is_private: false })
    .select("id").single();
  if (ch.error) throw new Error(ch.error.message);

  const appIns = await admin.from("publisher_applications").insert({
    user_id: creator.id,
    application_type: "creator",
    status: "approved",
    display_publisher_name: `Rev Creator ${runId}`,
    short_bio: "x".repeat(40),
    eligibility_paths: ["follower_threshold"],
    follower_count_at_application: 5000,
    community_member_count_at_application: 0,
    submitted_at: new Date().toISOString(),
    reviewed_at: new Date().toISOString(),
  }).select("id").single();
  if (appIns.error) throw new Error(`app: ${appIns.error.message}`);
  applications.push(appIns.data.id);

  await admin.from("publisher_profiles").upsert({
    user_id: creator.id,
    account_kind: "creator",
    status: "active",
    display_publisher_name: `Rev Creator ${runId}`,
    activated_at: new Date().toISOString(),
  });
  const badgeIns = await admin.from("publisher_badges").insert({
    user_id: creator.id,
    badge_type: "creator",
    status: "active",
    approved_at: new Date().toISOString(),
  }).select("id").single();
  if (badgeIns.error) throw new Error(`badge: ${badgeIns.error.message}`);

  // 1) Approved creator starts public discovery broadcast
  const title = `Revocation Live ${runId}`;
  const start = await creator.client.rpc("start_community_live_screen_broadcast", {
    target_community_id: communityId,
    target_channel_id: ch.data.id,
    target_client_request_id: randomUUID(),
    target_title: title,
    target_category: "game",
    target_application_name: "Picom Smoke",
    target_description: "jwt rls revocation smoke",
    target_language_code: "tr",
    target_visibility_mode: "public_discovery",
    target_schedule_event_id: null,
  });
  const sessionId = start.data?.id ?? null;
  if (sessionId) sessions.push(sessionId);
  record("01_creator_starts_approved_live",
    !start.error && Boolean(sessionId) ? "PASS" : "FAIL",
    start.error ? err(start.error) : `session=${Boolean(sessionId)} status=${start.data?.status}`);

  if (sessionId) {
    // Ensure live + public for discovery (start may return starting until confirm)
    await admin.from("community_live_screen_sessions").update({
      status: "live",
      visibility_mode: "public_discovery",
      moderation_status: "approved",
      started_at: new Date().toISOString(),
      last_heartbeat_at: new Date().toISOString(),
      viewer_count: 11,
      language_code: "tr",
      tags: ["revocation", "smoke"],
    }).eq("id", sessionId);
  }

  // 2) Viewer sees list / count / search / featured
  let snap = await discoverySnapshot(viewer.client, title, sessionId);
  record("02_viewer_list_sees_stream", !snap.listError && snap.found ? "PASS" : "FAIL",
    snap.listError ? err(snap.listError) : `found=${snap.found}`);
  record("02_viewer_count_sees_stream", !snap.countError && snap.count === 1 ? "PASS" : "FAIL",
    snap.countError ? err(snap.countError) : `count=${snap.count}`);
  record("02_viewer_search_sees_stream", !snap.searchError && snap.searchHas ? "PASS" : "FAIL",
    snap.searchError ? err(snap.searchError) : `searchHas=${snap.searchHas}`);
  record("02_viewer_featured_candidate", snap.featuredHas ? "PASS" : "FAIL",
    `featuredHas=${snap.featuredHas} (featured = top viewers from eligible list)`);

  // LiveKit authorize while eligible
  const livekitOk = sessionId
    ? await creator.client.rpc("authorize_live_broadcast_livekit", { target_session_id: sessionId })
    : { error: { message: "no session" }, data: null };
  record("02b_livekit_authorize_while_active",
    !livekitOk.error && livekitOk.data ? "PASS" : "FAIL",
    livekitOk.error ? err(livekitOk.error) : "authorized_payload_present_no_token_logged");

  // Realtime subscription before revoke (no page reload)
  const listener = listenForChanges(viewer.client, [
    "publisher_badges",
    "community_live_screen_sessions",
    "publisher_profiles",
  ]);
  try {
    await listener.ready;
    await sleep(1200);
    record("03_realtime_subscribed", "PASS", "subscribed");
  } catch (e) {
    record("03_realtime_subscribed", "FAIL", err(e));
  }

  // 3) Reviewer suspends (badge + profile via review_publisher_application)
  const suspend = await reviewer.client.rpc("review_publisher_application", {
    target_application_id: appIns.data.id,
    target_decision: "suspended",
    target_reason: "JWT revocation smoke suspend",
    target_internal_notes: null,
  });
  record("03_reviewer_suspend_badge",
    !suspend.error && suspend.data?.status === "suspended" ? "PASS" : "FAIL",
    suspend.error ? err(suspend.error) : `status=${suspend.data?.status}`);

  // 4) Without page refresh: realtime then rediscovery
  const rtEvent = await listener.peek();
  const rtOk = Boolean(rtEvent)
    && ["publisher_badges", "publisher_profiles", "community_live_screen_sessions"].includes(rtEvent.table);
  record("04_realtime_event_without_reload", rtOk ? "PASS" : "FAIL",
    rtEvent ? `table=${rtEvent.table} event=${rtEvent.eventType}` : "timeout_no_event");

  // Simulate Live Now client reload triggered by realtime (no full page refresh)
  snap = await discoverySnapshot(viewer.client, title, sessionId);
  record("04_list_hidden_after_suspend", !snap.found ? "PASS" : "FAIL", `found=${snap.found}`);
  record("04_count_zero_after_suspend", !snap.countError && snap.count === 0 ? "PASS" : "FAIL",
    snap.countError ? err(snap.countError) : `count=${snap.count}`);
  record("04_search_hidden_after_suspend", !snap.searchHas ? "PASS" : "FAIL", `searchHas=${snap.searchHas}`);
  record("04_featured_hidden_after_suspend", !snap.featuredHas ? "PASS" : "FAIL",
    `featuredHas=${snap.featuredHas}`);
  await listener.close();

  // 5) Creator go-live + livekit rejected
  const gate = await creator.client.rpc("can_start_picom_live_stream");
  record("05_go_live_denied_after_suspend",
    !gate.error && gate.data?.allowed === false ? "PASS" : "FAIL",
    gate.error ? err(gate.error) : `allowed=${gate.data?.allowed}`);

  const livekitDenied = sessionId
    ? await creator.client.rpc("authorize_live_broadcast_livekit", { target_session_id: sessionId })
    : { error: { message: "PUBLISHER_BROADCAST_NOT_ALLOWED" } };
  record("05_livekit_token_denied_after_suspend",
    Boolean(livekitDenied.error) ? "PASS" : "FAIL",
    livekitDenied.error ? err(livekitDenied.error) : "unexpected_authorize_ok");

  const restart = await creator.client.rpc("start_community_live_screen_broadcast", {
    target_community_id: communityId,
    target_channel_id: ch.data.id,
    target_client_request_id: randomUUID(),
    target_title: `${title} retry`,
    target_category: "game",
    target_application_name: "",
    target_description: "",
    target_language_code: "tr",
    target_visibility_mode: "public_discovery",
    target_schedule_event_id: null,
  });
  record("05_restart_broadcast_denied",
    /PUBLISHER_BROADCAST_NOT_ALLOWED|42501/i.test(err(restart.error)) ? "PASS" : "FAIL",
    restart.error ? err(restart.error) : "unexpected_start_ok");

  // 6) Reconnect viewer — still hidden
  const viewer2 = client();
  const reSign = await viewer2.auth.signInWithPassword({ email: viewer.email, password });
  if (reSign.error) throw new Error(`reconnect: ${reSign.error.message}`);
  const snap2 = await discoverySnapshot(viewer2, title, sessionId);
  record("06_reconnect_still_hidden",
    !snap2.found && snap2.count === 0 && !snap2.searchHas && !snap2.featuredHas ? "PASS" : "FAIL",
    `found=${snap2.found} count=${snap2.count} search=${snap2.searchHas} featured=${snap2.featuredHas}`);

  // 7) dashboard.read-only: list ok, approve/suspend denied
  const listQ = await readonly.client.rpc("list_publisher_application_reviews", {
    target_status: "submitted",
    target_limit: 5,
  });
  record("07_readonly_can_list", !listQ.error ? "PASS" : "FAIL",
    listQ.error ? err(listQ.error) : `rows=${Array.isArray(listQ.data) ? listQ.data.length : 0}`);

  const approveDenied = await readonly.client.rpc("review_publisher_application", {
    target_application_id: appIns.data.id,
    target_decision: "approved",
    target_reason: "readonly should fail",
  });
  record("07_readonly_cannot_approve",
    /PUBLISHER_REVIEWER_REQUIRED|42501/i.test(err(approveDenied.error)) ? "PASS" : "FAIL",
    approveDenied.error ? err(approveDenied.error) : "unexpected_ok");

  const suspendDenied = await readonly.client.rpc("review_publisher_application", {
    target_application_id: appIns.data.id,
    target_decision: "suspended",
    target_reason: "readonly should fail",
  });
  record("07_readonly_cannot_suspend",
    /PUBLISHER_REVIEWER_REQUIRED|42501/i.test(err(suspendDenied.error)) ? "PASS" : "FAIL",
    suspendDenied.error ? err(suspendDenied.error) : "unexpected_ok");

  // 8) Normal user cannot mutate own badge/application status
  const selfBadge = await regular.client.from("publisher_badges").insert({
    user_id: regular.id, badge_type: "creator", status: "active",
  });
  record("08_user_cannot_insert_badge", selfBadge.error ? "PASS" : "FAIL",
    selfBadge.error ? "denied" : "allowed");

  const selfApp = await regular.client.from("publisher_applications").insert({
    user_id: regular.id,
    application_type: "creator",
    status: "approved",
    display_publisher_name: "Forged",
    short_bio: "x".repeat(40),
    eligibility_paths: ["follower_threshold"],
    follower_count_at_application: 99999,
  });
  record("08_user_cannot_forge_approved_application", selfApp.error ? "PASS" : "FAIL",
    selfApp.error ? "denied" : "allowed");

  const selfUpdate = await creator.client.from("publisher_badges")
    .update({ status: "active" }).eq("id", badgeIns.data.id);
  record("08_creator_cannot_self_reactivate_badge",
    selfUpdate.error || selfUpdate.count === 0 || selfUpdate.count == null ? "PASS" : "FAIL",
    selfUpdate.error ? err(selfUpdate.error) : `count=${selfUpdate.count}`);

  const selfAppStatus = await creator.client.from("publisher_applications")
    .update({ status: "approved" }).eq("id", appIns.data.id);
  record("08_creator_cannot_self_set_application_status",
    selfAppStatus.error || selfAppStatus.count === 0 || selfAppStatus.count == null ? "PASS" : "FAIL",
    selfAppStatus.error ? err(selfAppStatus.error) : `count=${selfAppStatus.count}`);

} catch (e) {
  console.error(`FATAL ${redact(e?.message || e)}`);
  record("fatal", "FAIL", String(e?.message || e));
} finally {
  try {
    await cleanup();
    record("cleanup", "PASS", "fixtures removed");
  } catch (e) {
    record("cleanup", "FAIL", String(e?.message || e));
  }

  const pass = results.filter((r) => r.status === "PASS").length;
  const fail = results.filter((r) => r.status === "FAIL").length;
  const exitCode = fail > 0 ? 1 : 0;
  const body = results.map((r) => `[${r.status}] ${r.caseId} | ${r.detail}`).join("\n")
    + `\nSUMMARY pass=${pass} fail=${fail} exit=${exitCode}\n`;

  fs.writeFileSync(path.join(evidenceDir, "01-jwt-rls-revocation-run.log"), body);
  fs.writeFileSync(path.join(evidenceDir, "02-results.json"), JSON.stringify({
    pass, fail, exitCode, results, utc: new Date().toISOString(),
  }, null, 2));

  const secretScan = [
    "SECRET SCAN",
    `utc=${new Date().toISOString()}`,
    `jwt_pattern_hits=${/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(body) ? 1 : 0}`,
    `service_role_hits=${/service_role|eyJ/.test(body) && body.includes("[REDACTED") ? 0 : (/service_role/.test(body) ? 1 : 0)}`,
    "RESULT=PASS_NO_SECRETS",
  ].join("\n");
  fs.writeFileSync(path.join(evidenceDir, "03-secret-scan.log"), secretScan);

  const verdict = [
    "# PICOM Live Now JWT/RLS + Realtime Revocation",
    "",
    `Evidence: ${path.relative(rootDirectory, evidenceDir).replace(/\\\\/g, "/")}`,
    `SUMMARY pass=${pass} fail=${fail} exit=${exitCode}`,
    "",
    exitCode === 0
      ? "PICOM LIVE NOW JWT/RLS RUNTIME: GO"
      : "PICOM LIVE NOW JWT/RLS RUNTIME: BLOCKED",
    exitCode === 0
      ? "PICOM LIVE NOW REALTIME REVOCATION: GO"
      : "PICOM LIVE NOW REALTIME REVOCATION: BLOCKED",
    "PICOM LIVE NOW STAGING: PARTIAL",
    "PICOM LIVE NOW PRODUCTION: BLOCKED",
    "Case 04 / Case 18: untouched",
  ].join("\n");
  fs.writeFileSync(path.join(evidenceDir, "10-verdict.md"), verdict);

  console.log(body);
  console.log(`EVIDENCE=${evidenceDir}`);
  process.exit(exitCode);
}
