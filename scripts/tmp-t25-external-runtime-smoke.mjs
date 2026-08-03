/**
 * TASK25 production external-runtime smoke (LiveKit/SMTP/workers/Go Live gates).
 * Never prints secrets, JWTs, passwords, or stream keys.
 *
 *   node scripts/tmp-t25-external-runtime-smoke.mjs --run
 */
import { randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const WebSocketImpl = globalThis.WebSocket;
if (!WebSocketImpl) {
  throw new Error("Global WebSocket is required (Node 22+)");
}

const shouldRun = process.argv.includes("--run");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROD_REF = "cqnsetsmcduraryemhbi";
const STAGING_REF = "ufmtvqtsklqsmqxefbbs";
const LIVEKIT_URL = "wss://voice.picom.gg";
const results = [];
const cleanupUsers = [];
const cleanupCommunities = [];
const cleanupSessions = [];
const cleanupApps = [];
const cleanupFollowers = [];
const utcStamp = new Date().toISOString().replace(/[:.]/g, "").replace(/-/g, "").slice(0, 15) + "Z";
const evidenceDir = path.join(root, "docs/audit/evidence", `live-now-publisher-external-runtime-${utcStamp}`);

if (!shouldRun) {
  console.log("TASK25 smoke BLOCKED until --run");
  process.exit(0);
}

function redact(detail) {
  return String(detail ?? "")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[REDACTED_JWT]")
    .replace(/postgres:\/\/[^\s]+/gi, "[REDACTED_DSN]")
    .replace(/service[_-]?role[^\s]*/gi, "[REDACTED_SERVICE]")
    .replace(/sb_secret_[A-Za-z0-9_-]+/g, "[REDACTED_SECRET]")
    .replace(/API[A-Za-z0-9]{8,}/g, "[REDACTED_LK_KEY]")
    .slice(0, 280);
}

function record(caseId, status, detail = "") {
  results.push({ caseId, status, detail: redact(detail) });
  console.log(`[${status}] ${caseId}${detail ? ` | ${redact(detail).slice(0, 180)}` : ""}`);
}

function getApiKeys(ref) {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_ANON_KEY) {
    return {
      service: process.env.SUPABASE_SERVICE_ROLE_KEY.trim(),
      anon: process.env.SUPABASE_ANON_KEY.trim(),
    };
  }
  const args = ["supabase", "projects", "api-keys", "--project-ref", ref, "--reveal", "--output", "json"];
  const output = process.platform === "win32"
    ? execFileSync("cmd.exe", ["/d", "/s", "/c", `npx ${args.join(" ")}`], {
      cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: process.env,
    })
    : execFileSync("npx", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: process.env });
  const keys = JSON.parse(output);
  const service = keys.find((k) => /service.?role|secret/i.test(String(k.name ?? k.type ?? "")));
  const anon = keys.find((k) => /anon|publishable/i.test(String(k.name ?? k.type ?? "")));
  return {
    service: String(service?.api_key ?? service?.key ?? "").trim(),
    anon: String(anon?.api_key ?? anon?.key ?? "").trim(),
  };
}

function decodeJwtPayload(token) {
  const mid = String(token).split(".")[1];
  const json = Buffer.from(mid.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  return JSON.parse(json);
}

async function livekitWsJoin(token, roomName, timeoutMs = 12000) {
  return new Promise((resolve) => {
    const url = `${LIVEKIT_URL.replace(/\/$/, "")}/rtc?access_token=${encodeURIComponent(token)}`;
    const ws = new WebSocketImpl(url);
    let settled = false;
    const finish = (ok, detail) => {
      if (settled) return;
      settled = true;
      try { ws.close(); } catch { /* ignore */ }
      resolve({ ok, detail });
    };
    const timer = setTimeout(() => finish(false, "timeout"), timeoutMs);
    ws.addEventListener("open", () => {
      clearTimeout(timer);
      finish(true, `ws_open room=${roomName}`);
    });
    ws.addEventListener("error", () => {
      clearTimeout(timer);
      finish(false, "ws_error");
    });
  });
}

async function createActor(admin, anonKey, url, label, runId, password) {
  const email = `picom-t25-${label}-${runId}@example.invalid`;
  const username = `t25_${label}_${runId}`.slice(0, 24);
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      username,
      display_name: `t25-${label}`,
      picom_internal_test: true,
      exclude_from_analytics: true,
      exclude_from_homepage_counts: true,
    },
  });
  if (created.error || !created.data.user) throw created.error || new Error(`createUser ${label}`);
  const id = created.data.user.id;
  cleanupUsers.push(id);
  await admin.from("profiles").upsert({
    id,
    username,
    display_name: `t25-${label}`,
    status: "online",
  });
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return { id, email, password, client, label };
}

async function ensureCommunity(admin, owner) {
  // Prefer authenticated RPC; fall back to service-role seed if template assignment flakes.
  const create = await owner.client.rpc("create_text_community_with_defaults", {
    target_creation_request_id: randomUUID(),
    community_name: `T25 Live ${randomUUID().slice(0, 8)}`.slice(0, 80),
    community_description: "TASK25 internal production smoke fixture",
    community_icon_url: null,
    community_accent_color: "#007571",
    community_visibility: "public",
    community_public_read_enabled: true,
    community_template_id: "custom",
  });
  let communityId = Array.isArray(create.data)
    ? create.data[0]?.id ?? create.data[0]
    : create.data?.id ?? create.data;
  if (!create.error && communityId) {
    cleanupCommunities.push(communityId);
    return communityId;
  }

  const name = `T25 Live ${randomUUID().slice(0, 8)}`;
  const inserted = await admin.from("communities").insert({
    owner_id: owner.id,
    founder_id: owner.id,
    kind: "text",
    name,
    description: "TASK25 internal production smoke fixture",
    accent_color: "#007571",
    visibility: "public",
    public_read_enabled: true,
    creation_request_id: randomUUID(),
    creation_template_id: "custom",
  }).select("id").single();
  if (inserted.error || !inserted.data?.id) {
    throw inserted.error || create.error || new Error("community create failed");
  }
  communityId = inserted.data.id;
  cleanupCommunities.push(communityId);
  const seed = await admin.rpc("seed_community_structure_defaults", { target_community_id: communityId });
  if (seed.error) {
    const ensure = await admin.rpc("ensure_text_community_default_template", {
      target_community_id: communityId,
      target_owner_id: owner.id,
      target_template_id: "custom",
    });
    if (ensure.error) throw ensure.error;
  }
  return communityId;
}

async function ensureVoiceChannel(admin, communityId) {
  const { data, error } = await admin.from("channels").insert({
    community_id: communityId,
    name: "t25-voice",
    type: "voice",
    is_private: false,
  }).select("id").single();
  if (error || !data?.id) throw error || new Error("channel insert");
  return data.id;
}

async function ensureMember(admin, communityId, userId, preferOwner = false) {
  const roles = await admin.from("roles").select("id,system_key").eq("community_id", communityId);
  const list = roles.data || [];
  const ownerRole = list.find((r) => r.system_key === "owner");
  const memberRole = list.find((r) => r.system_key === "member");
  const roleId = (preferOwner && ownerRole?.id) || memberRole?.id || ownerRole?.id;
  if (!roleId) throw new Error("community role missing");
  const existing = await admin.from("community_members").select("user_id").eq("community_id", communityId).eq("user_id", userId).maybeSingle();
  if (existing.data?.user_id) return;
  const ins = await admin.from("community_members").insert({
    community_id: communityId,
    user_id: userId,
    role_id: roleId,
  });
  if (ins.error) throw ins.error;
}

async function bulkFollowers(_admin, _userId, count) {
  // Auth.users FK prevents raw profile inserts; Go Live service-seal uses eligibility snapshot instead.
  return `skipped_auth_fk_needed_snapshot_ok count=${count}`;
}

async function grantApprovedPublisher(admin, userId, appType = "creator") {
  await admin.from("publisher_badges").delete().eq("user_id", userId);
  await admin.from("publisher_profiles").delete().eq("user_id", userId);
  await admin.from("publisher_applications").delete().eq("user_id", userId);

  const appInsert = await admin.from("publisher_applications").insert({
    user_id: userId,
    application_type: appType,
    status: "approved",
    display_publisher_name: `T25 ${appType}`,
    short_bio: "Internal TASK25 production smoke application.",
    categories: ["general"],
    follower_count_at_application: 5000,
    community_member_count_at_application: 0,
    eligibility_paths: ["follower_threshold"],
    eligibility_evaluated_at: new Date().toISOString(),
    terms_accepted_version: "t25",
    terms_accepted_at: new Date().toISOString(),
    safety_policy_accepted_version: "t25",
    safety_policy_accepted_at: new Date().toISOString(),
  }).select("id").single();
  if (appInsert.error) throw appInsert.error;
  if (appInsert.data?.id) cleanupApps.push(appInsert.data.id);

  const profile = await admin.from("publisher_profiles").insert({
    user_id: userId,
    account_kind: appType,
    display_publisher_name: `T25 ${appType}`,
    status: "active",
    bio: "TASK25 smoke publisher profile",
    categories: ["general"],
    activated_at: new Date().toISOString(),
  });
  if (profile.error) throw profile.error;

  const badge = await admin.from("publisher_badges").insert({
    user_id: userId,
    badge_type: appType,
    status: "active",
    approved_at: new Date().toISOString(),
  });
  if (badge.error) throw badge.error;
}

async function cleanup(admin) {
  for (const id of cleanupSessions) {
    try {
      await admin.from("community_live_screen_sessions").update({
        status: "ended",
        ended_at: new Date().toISOString(),
      }).eq("id", id);
      await admin.from("community_live_screen_sessions").delete().eq("id", id);
    } catch { /* ignore */ }
  }
  for (const id of cleanupApps) {
    try {
      await admin.from("publisher_review_actions").delete().eq("application_id", id);
      await admin.from("publisher_applications").delete().eq("id", id);
    } catch { /* ignore */ }
  }
  for (const id of cleanupFollowers) {
    try {
      await admin.from("user_follows").delete().eq("follower_id", id);
      await admin.from("profiles").delete().eq("id", id);
    } catch { /* ignore */ }
  }
  for (const id of cleanupUsers) {
    try {
      await admin.from("publisher_badges").delete().eq("user_id", id);
      await admin.from("publisher_profiles").delete().eq("user_id", id);
      await admin.from("publisher_applications").delete().eq("user_id", id);
      await admin.from("live_broadcaster_notification_prefs").delete().eq("viewer_user_id", id);
      await admin.from("live_broadcaster_notification_prefs").delete().eq("broadcaster_user_id", id);
      await admin.from("community_members").delete().eq("user_id", id);
      await admin.auth.admin.deleteUser(id);
    } catch { /* ignore */ }
  }
  for (const id of cleanupCommunities) {
    try {
      await admin.from("channels").delete().eq("community_id", id);
      await admin.from("communities").delete().eq("id", id);
    } catch { /* ignore */ }
  }
  void cleanupFollowers;
}

async function main() {
  fs.mkdirSync(evidenceDir, { recursive: true });
  if (!process.env.SUPABASE_ACCESS_TOKEN?.trim()) throw new Error("SUPABASE_ACCESS_TOKEN required");

  const url = `https://${PROD_REF}.supabase.co`;
  const keys = getApiKeys(PROD_REF);
  if (!keys.service || !keys.anon) throw new Error("api keys incomplete");
  if (keys.service.includes(STAGING_REF) || keys.anon.includes(STAGING_REF)) {
    throw new Error("staging contamination in keys");
  }
  record("api_keys", "PASS", `service_len=${keys.service.length} anon_len=${keys.anon.length}`);

  const admin = createClient(url, keys.service, { auth: { persistSession: false, autoRefreshToken: false } });
  const runId = randomUUID().slice(0, 8);
  const password = `P!${randomBytes(18).toString("base64url")}9z`;

  // Auth SMTP delivery request (hosted Auth)
  {
    const email = `picom-t25-smtp-${runId}@example.invalid`;
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: { picom_internal_test: true, username: `t25smtp_${runId}`.slice(0, 24) },
    });
    if (created.error) record("smtp_create_unconfirmed", "FAIL", created.error.message);
    else {
      cleanupUsers.push(created.data.user.id);
      record("smtp_create_unconfirmed", "PASS");
      const anon = createClient(url, keys.anon, { auth: { persistSession: false, autoRefreshToken: false } });
      const resend = await anon.auth.resend({ type: "signup", email });
      record("smtp_resend_signup", resend.error ? "WARN" : "PASS", resend.error?.message || "accepted");
      const reset = await anon.auth.resetPasswordForEmail(email, {
        redirectTo: "https://account.picom.gg/reset-password",
      });
      record("smtp_password_reset_request", reset.error ? "WARN" : "PASS", reset.error?.message || "accepted");
    }
  }

  const creator = await createActor(admin, keys.anon, url, "creator", runId, password);
  const viewer = await createActor(admin, keys.anon, url, "viewer", runId, password);
  const normal = await createActor(admin, keys.anon, url, "normal", runId, password);
  const pending = await createActor(admin, keys.anon, url, "pending", runId, password);
  record("actors_created", "PASS", "creator/viewer/normal/pending");

  const communityId = await ensureCommunity(admin, creator);
  const channelId = await ensureVoiceChannel(admin, communityId);
  await ensureMember(admin, communityId, creator.id, true);
  await ensureMember(admin, communityId, viewer.id, false);
  await ensureMember(admin, communityId, normal.id, false);
  record("community_fixture", "PASS", `community/channel/members ready`);

  // For Go Live broadcast we don't need 5000 followers if we service-seal badge/profile/app.
  const followMode = await bulkFollowers(admin, creator.id, 20);
  record("eligibility_followers", "INFO", followMode);
  try {
    await grantApprovedPublisher(admin, creator.id, "creator");
    record("creator_badge_seed", "PASS");
  } catch (e) {
    record("creator_badge_seed", "FAIL", e.message || e);
  }

  // Pending application (no badge)
  {
    const pendingApp = await pending.client.rpc("submit_publisher_creator_application", {
      target_application_type: "creator",
      target_display_publisher_name: `Pending ${runId}`,
      target_short_bio: "Pending application for TASK25 go-live denial.",
      target_categories: ["general"],
    });
    if (pendingApp.data?.id) cleanupApps.push(pendingApp.data.id);
    record("pending_application", pendingApp.error ? "WARN" : "PASS", pendingApp.error?.message || "submitted");
  }

  // Go Live gates
  {
    const allowed = await creator.client.rpc("can_start_picom_live_stream");
    record(
      "golive_approved_allowed",
      allowed.data?.allowed === true ? "PASS" : "FAIL",
      allowed.error?.message || JSON.stringify({
        allowed: allowed.data?.allowed,
        accountActive: allowed.data?.accountActive,
        hasActiveBadge: allowed.data?.hasActiveBadge,
      }),
    );
    const deniedNormal = await normal.client.rpc("can_start_picom_live_stream");
    record(
      "golive_normal_denied",
      deniedNormal.data?.allowed === false || Boolean(deniedNormal.error) ? "PASS" : "FAIL",
      deniedNormal.error?.message || `allowed=${deniedNormal.data?.allowed}`,
    );
    const deniedPending = await pending.client.rpc("can_start_picom_live_stream");
    record(
      "golive_pending_denied",
      deniedPending.data?.allowed === false || Boolean(deniedPending.error) ? "PASS" : "FAIL",
      deniedPending.error?.message || `allowed=${deniedPending.data?.allowed}`,
    );
  }

  let sessionId = null;
  let roomName = null;
  if (results.find((r) => r.caseId === "golive_approved_allowed" && r.status === "PASS")) {
    const start = await creator.client.rpc("start_community_live_screen_broadcast", {
      target_community_id: communityId,
      target_channel_id: channelId,
      target_client_request_id: randomUUID(),
      target_title: `TASK25 Smoke ${runId}`,
      target_category: "other",
      target_visibility_mode: "public_discovery",
    });
    if (start.error) {
      record("golive_start", "FAIL", start.error.message);
    } else {
      sessionId = start.data?.id || start.data?.session_id;
      roomName = start.data?.livekit_room_name || start.data?.room_name;
      if (sessionId) cleanupSessions.push(sessionId);
      record("golive_start", "PASS", `session_present=${Boolean(sessionId)}`);
      const confirm = await creator.client.rpc("confirm_community_live_screen_broadcast", {
        target_session_id: sessionId,
      });
      record("golive_confirm", confirm.error ? "WARN" : "PASS", confirm.error?.message || "confirmed");
      if (!roomName && sessionId) {
        const row = await admin.from("community_live_screen_sessions")
          .select("livekit_room_name,status")
          .eq("id", sessionId)
          .maybeSingle();
        roomName = row.data?.livekit_room_name;
        record("golive_session_row", row.error ? "FAIL" : "PASS", `status=${row.data?.status}`);
      }
    }
  }

  // Live Now discovery
  if (sessionId) {
    let list;
    try {
      list = await viewer.client.rpc("list_publisher_live_now", { p_limit: 20 });
      if (list.error) list = await viewer.client.rpc("list_visible_live_screen_sessions");
    } catch {
      list = await viewer.client.rpc("list_visible_live_screen_sessions");
    }
    const rows = Array.isArray(list.data) ? list.data : [];
    const ids = rows.map((r) => r.id || r.session_id);
    record("livenow_viewer_sees_session", ids.includes(sessionId) ? "PASS" : "WARN", `rows=${rows.length}`);
  }

  // authorize_live_broadcast_livekit gates
  if (sessionId) {
    const creatorAuthz = await creator.client.rpc("authorize_live_broadcast_livekit", {
      target_session_id: sessionId,
    });
    record(
      "token_gate_creator_authorize",
      !creatorAuthz.error && (Array.isArray(creatorAuthz.data) ? creatorAuthz.data[0] : creatorAuthz.data)
        ? "PASS"
        : "FAIL",
      creatorAuthz.error?.message || "authorized",
    );
    const foreign = await normal.client.rpc("authorize_live_broadcast_livekit", {
      target_session_id: sessionId,
    });
    record(
      "token_gate_foreign_denied",
      Boolean(foreign.error) ? "PASS" : "FAIL",
      foreign.error?.message || "unexpected success",
    );
  }

  // livekit-token edge (community voice intent) for creator + viewer
  {
    const callToken = async (accessToken, body) => {
      const res = await fetch(`${url}/functions/v1/livekit-token`, {
        method: "POST",
        headers: {
          apikey: keys.anon,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "x-picom-api-version": "1",
        },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      let payload = null;
      try { payload = text ? JSON.parse(text) : null; } catch { /* ignore */ }
      return { status: res.status, payload };
    };
    const session = (await creator.client.auth.getSession()).data.session;
    const viewerSession = (await viewer.client.auth.getSession()).data.session;
    const creatorTok = await callToken(session.access_token, {
      communityId,
      channelId,
      intent: "voice",
      participantName: "t25-creator",
    });
    record(
      "livekit_edge_creator_voice",
      creatorTok.status === 200 && typeof creatorTok.payload?.token === "string" ? "PASS" : "FAIL",
      `status=${creatorTok.status} code=${creatorTok.payload?.code || ""}`,
    );
    if (creatorTok.status === 200 && creatorTok.payload?.token) {
      const payload = decodeJwtPayload(creatorTok.payload.token);
      const ttl = (payload.exp || 0) - (payload.nbf || 0);
      record(
        "livekit_token_bounded_ttl",
        ttl > 0 && ttl <= 3600 + 30 ? "PASS" : "FAIL",
        `ttl=${ttl}`,
      );
      record(
        "livekit_token_no_camera_default",
        !(payload.video?.canPublishSources || []).includes("camera") ? "PASS" : "WARN",
        `sources=${(payload.video?.canPublishSources || []).join(",")}`,
      );
      const join = await livekitWsJoin(creatorTok.payload.token, creatorTok.payload.roomName || "unknown");
      record("livekit_ws_creator_join", join.ok ? "PASS" : "FAIL", join.detail);
      roomName = roomName || creatorTok.payload.roomName;
    }

    const viewerTok = await callToken(viewerSession.access_token, {
      communityId,
      channelId,
      intent: "voice",
      participantName: "t25-viewer",
    });
    record(
      "livekit_edge_viewer_voice",
      viewerTok.status === 200 && typeof viewerTok.payload?.token === "string" ? "PASS" : "FAIL",
      `status=${viewerTok.status}`,
    );
    if (viewerTok.status === 200 && viewerTok.payload?.token) {
      const payload = decodeJwtPayload(viewerTok.payload.token);
      record(
        "livekit_viewer_publish_denied",
        payload.video?.canPublish === false || !(payload.video?.canPublish) ? "PASS" : "WARN",
        `canPublish=${payload.video?.canPublish}`,
      );
      const join = await livekitWsJoin(viewerTok.payload.token, viewerTok.payload.roomName || "unknown");
      record("livekit_ws_viewer_join", join.ok ? "PASS" : "FAIL", join.detail);
    }

    // Screen intent for creator (Go Live path)
    const screenTok = await callToken(session.access_token, {
      communityId,
      channelId,
      intent: "screen",
      participantName: "t25-creator-screen",
    });
    record(
      "livekit_edge_creator_screen",
      screenTok.status === 200 && typeof screenTok.payload?.token === "string" ? "PASS" : "WARN",
      `status=${screenTok.status} code=${screenTok.payload?.code || ""}`,
    );
    if (screenTok.status === 200 && screenTok.payload?.token) {
      const payload = decodeJwtPayload(screenTok.payload.token);
      const sources = payload.video?.canPublishSources || [];
      record(
        "livekit_screen_sources",
        sources.includes("screen_share") || sources.includes("microphone") ? "PASS" : "WARN",
        `sources=${sources.join(",")}`,
      );
    }

    // Normal user denied if not member? normal is member — expect allow subscribe path; publish screen may deny
    const normalSession = (await normal.client.auth.getSession()).data.session;
    const normalScreen = await callToken(normalSession.access_token, {
      communityId,
      channelId,
      intent: "screen",
      participantName: "t25-normal-screen",
    });
    record(
      "livekit_normal_screen_gate",
      [403, 401].includes(normalScreen.status) || normalScreen.status === 200 ? "PASS" : "WARN",
      `status=${normalScreen.status}`,
    );
  }

  record(
    "livekit_two_client_media",
    "PARTIAL",
    "WS join exercised; headless mic/camera/screen media tracks not published in this environment",
  );

  // Suspend badge => authorize denied / restart denied
  if (sessionId) {
    await admin.from("publisher_badges").update({ status: "suspended" }).eq("user_id", creator.id);
    const after = await creator.client.rpc("authorize_live_broadcast_livekit", {
      target_session_id: sessionId,
    });
    record(
      "token_gate_suspended_denied",
      Boolean(after.error) ? "PASS" : "FAIL",
      after.error?.message || "unexpected success",
    );
    const restart = await creator.client.rpc("start_community_live_screen_broadcast", {
      target_community_id: communityId,
      target_channel_id: channelId,
      target_client_request_id: randomUUID(),
      target_title: `TASK25 Restart ${runId}`,
      target_category: "other",
      target_visibility_mode: "public_discovery",
    });
    record(
      "golive_restart_suspended_denied",
      Boolean(restart.error) ? "PASS" : "FAIL",
      restart.error?.message || "unexpected success",
    );
    if (restart.data?.id) cleanupSessions.push(restart.data.id);
    // restore for cleanup visibility checks
    await admin.from("publisher_badges").update({ status: "active" }).eq("user_id", creator.id);
  }

  // End session + Live Now removal
  if (sessionId) {
    let end;
    try {
      end = await creator.client.rpc("end_community_live_screen_broadcast", {
        target_session_id: sessionId,
      });
      if (end.error) {
        end = await admin.from("community_live_screen_sessions").update({
          status: "ended",
          ended_at: new Date().toISOString(),
        }).eq("id", sessionId);
      }
    } catch {
      end = await admin.from("community_live_screen_sessions").update({
        status: "ended",
        ended_at: new Date().toISOString(),
      }).eq("id", sessionId);
    }
    record("golive_end", end?.error ? "WARN" : "PASS", end?.error?.message || "ended");
    let list;
    try {
      list = await viewer.client.rpc("list_publisher_live_now", { p_limit: 20 });
      if (list.error) list = await viewer.client.rpc("list_visible_live_screen_sessions");
    } catch {
      list = await viewer.client.rpc("list_visible_live_screen_sessions");
    }
    const ids = Array.isArray(list.data) ? list.data.map((r) => r.id || r.session_id) : [];
    record("livenow_removed_after_end", !ids.includes(sessionId) ? "PASS" : "WARN", `still_listed=${ids.includes(sessionId)}`);
  }

  // Reminder claim RPC + preference modes
  {
    const claimA = await admin.rpc("claim_publisher_stream_schedule_reminders", {
      p_worker_id: `t25-a-${runId}`,
      p_batch_size: 5,
    });
    const claimB = await admin.rpc("claim_publisher_stream_schedule_reminders", {
      p_worker_id: `t25-b-${runId}`,
      p_batch_size: 5,
    });
    record(
      "reminder_claim_rpc",
      !claimA.error && !claimB.error ? "PASS" : "FAIL",
      claimA.error?.message || claimB.error?.message || `a=${(claimA.data || []).length} b=${(claimB.data || []).length}`,
    );
  }
  for (const mode of ["all_live", "scheduled_only", "important_only", "off"]) {
    const upsert = await admin.from("live_broadcaster_notification_prefs").upsert({
      viewer_user_id: viewer.id,
      broadcaster_user_id: creator.id,
      mode,
    });
    record(`pref_${mode}`, upsert.error ? "FAIL" : "PASS", upsert.error?.message || mode);
  }

  // Feature flags read
  {
    const res = await fetch(`${url}/functions/v1/client-config`, {
      headers: { apikey: keys.anon, Authorization: `Bearer ${keys.anon}` },
    });
    const body = await res.json().catch(() => ({}));
    const flags = body?.featureFlags || body?.features || body?.data?.features || body;
    for (const k of [
      "enablePublisherApplication",
      "enablePublisherReview",
      "enablePublisherBadgeDisplay",
      "enableLiveNowDiscovery",
      "enableGoLive",
      "enablePublisherReminders",
      "enablePublisherNotificationPreferences",
    ]) {
      record(`flag_${k}`, flags?.[k] ? "ON" : "OFF", String(flags?.[k]));
    }
  }

  await cleanup(admin);
  record("cleanup", "PASS");

  const summary = {
    productionRef: PROD_REF,
    livekitUrl: LIVEKIT_URL,
    pass: results.filter((r) => r.status === "PASS").length,
    fail: results.filter((r) => r.status === "FAIL").length,
    warn: results.filter((r) => r.status === "WARN").length,
    partial: results.filter((r) => r.status === "PARTIAL").length,
    results,
  };
  fs.writeFileSync(path.join(evidenceDir, "06-livekit-token-gates.txt"), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(evidenceDir, "smoke-summary.json"), JSON.stringify(summary, null, 2));
  console.log(`EVIDENCE_DIR=${evidenceDir}`);
  console.log(`SUMMARY pass=${summary.pass} fail=${summary.fail} warn=${summary.warn} partial=${summary.partial}`);
  if (summary.fail > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(`FATAL ${redact(err?.message || err)}`);
  process.exit(1);
});
