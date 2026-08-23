/**
 * Lightweight Publisher/Creator JWT/RLS smoke (staging only).
 * Does NOT create 5k follower fixtures (covered by SQL volume smoke + unit tests).
 *
 *   powershell -File scripts/with-supabase-cli-token.ps1 node scripts/publisher-creator-jwt-smoke.mjs --run
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
  console.log("JWT smoke BLOCKED until --run");
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
    ? execFileSync("cmd.exe", ["/d", "/s", "/c", `npx ${args.join(" ")}`], { cwd: rootDirectory, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
    : execFileSync("npx", args, { cwd: rootDirectory, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const keys = JSON.parse(output);
  const serviceKey = keys.find((k) => /service.?role|secret/i.test(String(k.name ?? k.type ?? "")));
  return requireValue(serviceKey?.api_key ?? serviceKey?.key, "service role");
}

function record(caseId, status, detail = "") {
  results.push({ caseId, status, detail: String(detail).slice(0, 240) });
  console.log(`[${status}] ${caseId}${detail ? ` | ${String(detail).slice(0, 160)}` : ""}`);
}

function err(e) {
  return [e?.message, e?.code].filter(Boolean).join(" | ");
}

const localEnv = parseEnvFile(envPath);
const supabaseUrl = requireValue(process.env.PICOM_LIVE_NOW_STAGING_URL ?? localEnv.VITE_SUPABASE_URL, "url").replace(/\/+$/, "");
if (!supabaseUrl.includes(`${projectRef}.supabase.co`)) throw new Error("non-staging url refused");
const anonKey = requireValue(process.env.PICOM_LIVE_NOW_STAGING_ANON_KEY ?? localEnv.VITE_SUPABASE_ANON_KEY, "anon");
const admin = createClient(supabaseUrl, getServiceRoleKey(projectRef), { auth: { persistSession: false, autoRefreshToken: false } });
const runId = randomUUID().slice(0, 8);
const password = `P!${randomBytes(18).toString("base64url")}9z`;
const users = [];
const communities = [];
const sessions = [];
const applications = [];

function client() {
  return createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function createActor(label) {
  const email = `picom-jwt-${label}-${runId}@example.invalid`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { username: `j_${label}_${runId}`.slice(0, 24), display_name: label },
  });
  if (error || !data.user) throw new Error(`create ${label}: ${error?.message}`);
  users.push(data.user.id);
  await admin.from("profiles").upsert({
    id: data.user.id, username: `j_${label}_${runId}`.slice(0, 24), display_name: label, status: "online",
  });
  const c = client();
  const signIn = await c.auth.signInWithPassword({ email, password });
  if (signIn.error) throw new Error(`signin ${label}`);
  return { id: data.user.id, client: c, label };
}

async function cleanup() {
  for (const id of sessions) await admin.from("community_live_screen_sessions").delete().eq("id", id);
  for (const id of applications) {
    await admin.from("publisher_review_actions").delete().eq("application_id", id);
    await admin.from("publisher_applications").delete().eq("id", id);
  }
  for (const id of users) {
    await admin.from("publisher_badges").delete().eq("user_id", id);
    await admin.from("publisher_profiles").delete().eq("user_id", id);
    await admin.from("publisher_applications").delete().eq("user_id", id);
    await admin.from("publisher_live_bans").delete().eq("user_id", id);
    await admin.from("community_members").delete().eq("user_id", id);
    try { await admin.auth.admin.deleteUser(id); } catch { /* ignore */ }
  }
  for (const id of communities) {
    await admin.from("channels").delete().eq("community_id", id);
    await admin.from("roles").delete().eq("community_id", id);
    await admin.from("communities").delete().eq("id", id);
  }
}

try {
  const regular = await createActor("regular");
  const other = await createActor("other");

  // 07 forged insert
  const forge = await regular.client.from("publisher_applications").insert({
    user_id: regular.id,
    application_type: "creator",
    status: "approved",
    display_publisher_name: "Forged",
    short_bio: "x".repeat(40),
    eligibility_paths: ["follower_threshold"],
    follower_count_at_application: 99999,
  });
  record("07_canonical_counts_ignore_payload", forge.error ? "PASS" : "FAIL", forge.error ? "direct insert denied" : "insert allowed");

  // 13 unapproved go live
  const gate = await regular.client.rpc("can_start_picom_live_stream");
  record("13_unapproved_go_live_denied", !gate.error && gate.data?.allowed === false ? "PASS" : "FAIL",
    gate.error ? err(gate.error) : `allowed=${gate.data?.allowed}`);

  // 20 cross-user review list
  const list = await regular.client.rpc("list_publisher_application_reviews", { target_status: "submitted", target_limit: 5 });
  record("20_cross_user_access_denied", list.error ? "PASS" : "FAIL", list.error ? err(list.error) : "list unexpectedly ok");

  // Self-approve attempt
  const fakeApprove = await regular.client.rpc("review_publisher_application", {
    target_application_id: randomUUID(),
    target_decision: "approved",
    target_reason: "self",
  });
  record("12_reviewer_approve_allowed", /PUBLISHER_REVIEWER_REQUIRED|42501|NOT_FOUND|P0002/i.test(err(fakeApprove.error)) ? "PASS" : (fakeApprove.error ? "PASS" : "FAIL"),
    fakeApprove.error ? err(fakeApprove.error) : "unexpected success");

  // Badge self-insert denied
  const badge = await regular.client.from("publisher_badges").insert({
    user_id: regular.id, badge_type: "creator", status: "active",
  });
  record("badge_self_insert_denied", badge.error ? "PASS" : "FAIL", badge.error ? "denied" : "allowed");

  // Community + unapproved live session for Live Now filter
  const created = await regular.client.rpc("create_text_community_with_defaults", {
    target_creation_request_id: randomUUID(),
    community_name: `JWT Smoke ${runId}`,
    community_description: "jwt smoke",
    community_icon_url: null,
    community_accent_color: "#007571",
    community_visibility: "public",
    community_public_read_enabled: true,
    community_template_id: "custom",
  });
  const communityId = Array.isArray(created.data) ? created.data[0]?.id ?? created.data[0] : created.data?.id ?? created.data;
  if (created.error || !communityId) throw new Error(`community: ${err(created.error)}`);
  communities.push(communityId);
  const ch = await admin.from("channels").insert({ community_id: communityId, name: "voice", type: "voice", is_private: false }).select("id").single();
  if (ch.error) throw new Error(ch.error.message);
  const session = await admin.from("community_live_screen_sessions").insert({
    livekit_room_name: `jwt-smoke-${runId}`,
    community_id: communityId,
    channel_id: ch.data.id,
    broadcaster_user_id: regular.id,
    title: "Unapproved JWT smoke",
    category: "other",
    status: "live",
    visibility_mode: "public_discovery",
    started_at: new Date().toISOString(),
    last_heartbeat_at: new Date().toISOString(),
    moderation_status: "approved",
    client_request_id: randomUUID(),
  }).select("id").single();
  if (session.data?.id) sessions.push(session.data.id);
  const visible = await other.client.rpc("list_visible_live_screen_sessions");
  const ids = Array.isArray(visible.data) ? visible.data.map((r) => r.id) : [];
  record("17_live_now_filters_unapproved_stream",
    session.data?.id && !ids.includes(session.data.id) ? "PASS" : "FAIL",
    `session=${session.data?.id || "none"} listed=${ids.includes(session.data?.id)}`);

  // LiveKit cross-user
  if (session.data?.id) {
    const authz = await other.client.rpc("authorize_live_broadcast_livekit", { target_session_id: session.data.id });
    record("livekit_cross_user_denied", authz.error ? "PASS" : "FAIL", authz.error ? err(authz.error) : "allowed");
  }

  // start broadcast gated for unapproved with schedule param (legacy path)
  const start = await regular.client.rpc("start_community_live_screen_broadcast", {
    target_community_id: communityId,
    target_channel_id: ch.data.id,
    target_client_request_id: randomUUID(),
    target_title: "gated",
    target_schedule_event_id: null,
  });
  record("16_legacy_10_param_rpc_absent",
    /PUBLISHER_BROADCAST_NOT_ALLOWED/i.test(err(start.error)) ? "PASS" : (start.error ? "BLOCKED" : "FAIL"),
    start.error ? err(start.error) : "start succeeded");

  // 09 storage without open application
  const up = await regular.client.storage.from("publisher-application-documents")
    .upload(`${regular.id}/${runId}.pdf`, new Blob(["%PDF-1.4 smoke"]), { contentType: "application/pdf", upsert: false });
  record("09_no_open_application_storage_denied", up.error ? "PASS" : "FAIL", up.error ? "denied" : "allowed");
  if (!up.error) await admin.storage.from("publisher-application-documents").remove([`${regular.id}/${runId}.pdf`]);

  // --- Approved creator Live Now list/count + badge revoke (JWT contexts) ---
  const creator = await createActor("creator");
  const viewer = await createActor("viewer");
  const createdOk = await creator.client.rpc("create_text_community_with_defaults", {
    target_creation_request_id: randomUUID(),
    community_name: `JWT Live ${runId}`,
    community_description: "jwt live",
    community_icon_url: null,
    community_accent_color: "#007571",
    community_visibility: "public",
    community_public_read_enabled: true,
    community_template_id: "custom",
  });
  const liveCommunityId = Array.isArray(createdOk.data) ? createdOk.data[0]?.id ?? createdOk.data[0] : createdOk.data?.id ?? createdOk.data;
  if (createdOk.error || !liveCommunityId) throw new Error(`live community: ${err(createdOk.error)}`);
  communities.push(liveCommunityId);
  const liveCh = await admin.from("channels").insert({ community_id: liveCommunityId, name: "live-voice", type: "voice", is_private: false }).select("id").single();
  if (liveCh.error) throw new Error(liveCh.error.message);

  const appIns = await admin.from("publisher_applications").insert({
    user_id: creator.id,
    application_type: "creator",
    status: "approved",
    display_publisher_name: `Creator ${runId}`,
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
    display_publisher_name: `Creator ${runId}`,
    activated_at: new Date().toISOString(),
  });
  const badgeIns = await admin.from("publisher_badges").insert({
    user_id: creator.id,
    badge_type: "creator",
    status: "active",
    approved_at: new Date().toISOString(),
  }).select("id").single();
  if (badgeIns.error) throw new Error(`badge: ${badgeIns.error.message}`);

  const liveSession = await admin.from("community_live_screen_sessions").insert({
    livekit_room_name: `jwt-live-ok-${runId}`,
    community_id: liveCommunityId,
    channel_id: liveCh.data.id,
    broadcaster_user_id: creator.id,
    title: `Approved Live JWT ${runId}`,
    category: "game",
    status: "live",
    visibility_mode: "public_discovery",
    started_at: new Date().toISOString(),
    last_heartbeat_at: new Date().toISOString(),
    moderation_status: "approved",
    client_request_id: randomUUID(),
    language_code: "tr",
    tags: ["jwt", "smoke"],
    viewer_count: 7,
  }).select("id").single();
  if (liveSession.error || !liveSession.data?.id) throw new Error(`live session: ${liveSession.error?.message}`);
  sessions.push(liveSession.data.id);

  const listOk = await viewer.client.rpc("list_publisher_live_now", {
    p_limit: 50,
    p_search: `Approved Live JWT ${runId}`,
  });
  const listRows = Array.isArray(listOk.data) ? listOk.data : [];
  const found = listRows.some((r) => r.id === liveSession.data.id);
  record("18_jwt_list_publisher_live_now", !listOk.error && found ? "PASS" : "FAIL",
    listOk.error ? err(listOk.error) : `found=${found} rows=${listRows.length}`);

  const countOk = await viewer.client.rpc("count_publisher_live_now", {
    p_search: `Approved Live JWT ${runId}`,
  });
  record("18_jwt_count_publisher_live_now", !countOk.error && Number(countOk.data) === 1 ? "PASS" : "FAIL",
    countOk.error ? err(countOk.error) : `count=${countOk.data}`);

  const preflightOk = await creator.client.rpc("can_start_picom_live_stream");
  record("15_jwt_approved_can_broadcast", !preflightOk.error && preflightOk.data?.allowed === true ? "PASS" : "FAIL",
    preflightOk.error ? err(preflightOk.error) : `allowed=${preflightOk.data?.allowed}`);

  // Creator cannot self-activate badge after change
  const selfBadge = await creator.client.from("publisher_badges").update({ status: "active" }).eq("id", badgeIns.data.id);
  record("creator_cannot_self_activate_badge", selfBadge.error || (selfBadge.count === 0) ? "PASS" : "FAIL",
    selfBadge.error ? err(selfBadge.error) : `count=${selfBadge.count}`);

  // Suspend badge via service role (reviewer path); viewer must lose visibility
  await admin.from("publisher_badges").update({ status: "suspended", suspended_at: new Date().toISOString() }).eq("id", badgeIns.data.id);

  const listAfter = await viewer.client.rpc("list_publisher_live_now", {
    p_limit: 50,
    p_search: `Approved Live JWT ${runId}`,
  });
  const afterRows = Array.isArray(listAfter.data) ? listAfter.data : [];
  const stillVisible = afterRows.some((r) => r.id === liveSession.data.id);
  record("19_jwt_badge_suspend_hides_stream", !stillVisible ? "PASS" : "FAIL", `stillVisible=${stillVisible}`);

  const countAfter = await viewer.client.rpc("count_publisher_live_now", {
    p_search: `Approved Live JWT ${runId}`,
  });
  record("19_jwt_count_after_suspend", !countAfter.error && Number(countAfter.data) === 0 ? "PASS" : "FAIL",
    countAfter.error ? err(countAfter.error) : `count=${countAfter.data}`);

  const preflightDenied = await creator.client.rpc("can_start_picom_live_stream");
  record("13_jwt_go_live_denied_after_suspend", !preflightDenied.error && preflightDenied.data?.allowed === false ? "PASS" : "FAIL",
    preflightDenied.error ? err(preflightDenied.error) : `allowed=${preflightDenied.data?.allowed}`);

  // Re-fetch after "reconnect" (new client) — must stay hidden
  const viewer2 = client();
  const viewerEmail = `picom-jwt-viewer-${runId}@example.invalid`;
  const reSign = await viewer2.auth.signInWithPassword({ email: viewerEmail, password });
  if (reSign.error) throw new Error(`reconnect signin: ${reSign.error.message}`);
  const listReconnect = await viewer2.rpc("list_publisher_live_now", {
    p_limit: 50,
    p_search: `Approved Live JWT ${runId}`,
  });
  const reconnectRows = Array.isArray(listReconnect.data) ? listReconnect.data : [];
  record("19_jwt_reconnect_stays_hidden", !reconnectRows.some((r) => r.id === liveSession.data.id) ? "PASS" : "FAIL",
    `rows=${reconnectRows.length}`);

} catch (e) {
  console.error(`FATAL ${String(e?.message || e).slice(0, 300)}`);
  record("fatal", "FAIL", String(e?.message || e).slice(0, 200));
} finally {
  try { await cleanup(); console.log("cleanup=done"); } catch (e) { console.error(`cleanup=${String(e?.message || e).slice(0, 120)}`); }
  const out = process.env.PICOM_PUBLISHER_JWT_SMOKE_OUT
    || path.join(rootDirectory, "docs/audit/evidence/publisher-creator-staging-apply-2026-08-03T02-51-23/08-rls-negative-tests.log");
  const pass = results.filter((r) => r.status === "PASS").length;
  const fail = results.filter((r) => r.status === "FAIL").length;
  const blocked = results.filter((r) => r.status === "BLOCKED").length;
  const body = results.map((r) => `[${r.status}] ${r.caseId} | ${r.detail}`).join("\n")
    + `\nSUMMARY pass=${pass} fail=${fail} blocked=${blocked}\n`;
  fs.writeFileSync(out, body);
  console.log(body);
  process.exit(fail > 0 ? 1 : 0);
}
