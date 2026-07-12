import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const shouldRun = process.argv.includes("--run");
const matrix = JSON.parse(readFileSync("supabase/tests/hosted/v1-core-rls-matrix.json", "utf8"));
const baseEnvironment = [
  "PICOM_RLS_STAGING_URL",
  "PICOM_RLS_STAGING_ANON_KEY",
  "PICOM_RLS_STAGING_CONFIRM",
  "PICOM_RLS_MUTATION_CONFIRM",
];
const actorEnvironment = Object.entries(matrix.actors)
  .filter(([, actor]) => actor.authenticated)
  .flatMap(([, actor]) => [`${actor.envPrefix}_EMAIL`, `${actor.envPrefix}_PASSWORD`]);
const fixtureEnvironment = [...new Set([
  ...matrix.readCases.map((testCase) => testCase.fixtureEnv),
  ...(matrix.profileCases ?? []).map((testCase) => testCase.fixtureEnv),
  ...matrix.storageCases.flatMap((testCase) => [testCase.bucketEnv, testCase.pathEnv]),
  ...Object.values(matrix.fixtures),
])];
const requiredNames = [...baseEnvironment, ...actorEnvironment, ...fixtureEnvironment];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function pass(message) { console.log(`OK ${message}`); }
function fail(message) { throw new Error(`Hosted Full MVP RLS matrix failed: ${message}`); }
function isDenied(error) { return Boolean(error && ["42501", "PGRST301", "PGRST302"].includes(error.code)); }

function resolveTemplate(value) {
  return value.replace(/\$\{([A-Z0-9_]+)\}/g, (_, name) => process.env[name] ?? "");
}

function validateConfiguration() {
  const missing = requiredNames.filter((name) => !process.env[name]?.trim());
  if (missing.length) fail(`missing ${missing.join(", ")}. Values were not printed.`);
  if (process.env.PICOM_RLS_STAGING_CONFIRM !== "STAGING_ONLY") fail("PICOM_RLS_STAGING_CONFIRM must equal STAGING_ONLY.");
  if (process.env.PICOM_RLS_MUTATION_CONFIRM !== "ALLOW_EPHEMERAL_WRITES") fail("PICOM_RLS_MUTATION_CONFIRM must equal ALLOW_EPHEMERAL_WRITES.");
  if (/service[_-]?role|sb_secret_/i.test(process.env.PICOM_RLS_STAGING_ANON_KEY)) fail("staging key must be anon/publishable, not service-role.");
  let url;
  try { url = new URL(process.env.PICOM_RLS_STAGING_URL); } catch { fail("staging URL is invalid."); }
  if (url.protocol !== "https:" || url.username || url.password) fail("staging URL must be credential-free HTTPS.");
  for (const name of fixtureEnvironment.filter((value) => value.endsWith("_ID"))) {
    if (!uuidPattern.test(process.env[name])) fail(`${name} must contain a staging UUID fixture.`);
  }
}

function createStagingClient() {
  return createClient(process.env.PICOM_RLS_STAGING_URL, process.env.PICOM_RLS_STAGING_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function authenticateActors() {
  const actors = new Map();
  for (const [name, actor] of Object.entries(matrix.actors)) {
    const client = createStagingClient();
    if (!actor.authenticated) {
      actors.set(name, { client, user: null });
      continue;
    }
    const { data, error } = await client.auth.signInWithPassword({
      email: process.env[`${actor.envPrefix}_EMAIL`],
      password: process.env[`${actor.envPrefix}_PASSWORD`],
    });
    if (error || !data.user || !data.session?.access_token) fail(`${name} synthetic account could not authenticate.`);
    await client.realtime.setAuth(data.session.access_token);
    actors.set(name, { client, user: data.user });
  }
  return actors;
}

async function signOutActors(actors) {
  await Promise.all([...actors.values()].filter((actor) => actor.user).map((actor) => actor.client.auth.signOut({ scope: "local" })));
}

async function verifyRoleFixtures(actors) {
  const communityId = process.env[matrix.fixtures.textCommunityId];
  for (const [name, actor] of Object.entries(matrix.actors)) {
    if (!actor.authenticated) continue;
    const session = actors.get(name);
    const { data, error } = await session.client
      .from("community_members")
      .select("role:roles(name,system_key)")
      .eq("community_id", communityId)
      .eq("user_id", session.user.id);
    if (error) fail(`${name} membership fixture query failed.`);
    const isMember = Boolean(data?.length);
    if (isMember !== actor.communityMember) fail(`${name} community membership fixture does not match the matrix.`);
    if (actor.role) {
      const relation = data?.[0]?.role;
      const role = Array.isArray(relation) ? relation[0] : relation;
      const actual = String(role?.system_key ?? role?.name ?? "").toLowerCase();
      if (actual !== actor.role) fail(`${name} role fixture is not ${actor.role}.`);
    }
  }
  pass("owner/admin/moderator/member/visitor/blocked/non-participant fixture identities");
}

async function visibleRow(client, testCase) {
  const value = process.env[testCase.fixtureEnv];
  const { data, error } = await client.from(testCase.relation).select(testCase.column).eq(testCase.column, value).limit(1);
  if (error) return { visible: false, denied: isDenied(error), error };
  return { visible: data?.length === 1, denied: false, error: null };
}

async function runReadMatrix(actors) {
  for (const testCase of matrix.readCases) {
    for (const [name, session] of actors) {
      const expected = testCase.allow.includes(name);
      const result = await visibleRow(session.client, testCase);
      if (result.error && !result.denied) fail(`${testCase.id} returned a non-authorization error for ${name}.`);
      if (result.visible !== expected) fail(`${testCase.id} visibility mismatch for ${name}; expected ${expected}.`);
    }
    pass(`${testCase.id}: SELECT boundary`);
  }
}

async function runProfileMatrix(actors) {
  for (const testCase of matrix.profileCases ?? []) {
    for (const [name, session] of actors) {
      const expected = testCase.allow.includes(name);
      const { data, error } = await session.client.rpc(testCase.rpc, {
        target_user_id: process.env[testCase.fixtureEnv],
        result_limit: 1,
      });
      const payload = Array.isArray(data) ? data[0] : data;
      const visible = !error && payload?.privacy?.can_view_profile === true;
      if (visible !== expected) fail(`${testCase.id} profile projection mismatch for ${name}; expected ${expected}.`);
    }
    pass(`${testCase.id}: privacy projection boundary`);
  }
}

async function runStorageMatrix(actors) {
  for (const testCase of matrix.storageCases) {
    for (const [name, session] of actors) {
      const expected = testCase.allow.includes(name);
      const { data, error } = await session.client.storage
        .from(process.env[testCase.bucketEnv])
        .download(process.env[testCase.pathEnv]);
      const visible = !error && Boolean(data);
      if (visible !== expected) fail(`${testCase.id} Storage visibility mismatch for ${name}; expected ${expected}.`);
    }
    pass(`${testCase.id}: Storage boundary`);
  }
}

async function runRealtimeMatrix(actors) {
  for (const testCase of matrix.realtimeCases) {
    const topic = resolveTemplate(testCase.topic);
    for (const [name, session] of actors) {
      const expected = testCase.allow.includes(name);
      const { data, error } = await session.client.rpc("can_access_picom_realtime_topic", {
        target_topic: topic,
        target_extension: testCase.extension,
      });
      const allowed = !error && data === true;
      if (allowed !== expected) fail(`${testCase.id} Realtime authorization mismatch for ${name}; expected ${expected}.`);
    }
    pass(`${testCase.id}: Realtime authorization`);
  }
}

function firstRow(data) { return Array.isArray(data) ? data[0] : data; }

async function deleteTextProbe(client, id) {
  if (!id) return;
  await client.rpc("delete_message_with_version", { target_message_id: id, expected_edited_at: null });
}

async function runTextMutationProbe(name, session, expected) {
  const clientMessageId = crypto.randomUUID();
  const args = {
    target_community_id: process.env[matrix.fixtures.textCommunityId],
    target_channel_id: process.env[matrix.fixtures.publicTextChannelId],
    message_body: `[RLS probe ${clientMessageId}]`,
    target_client_message_id: clientMessageId,
    target_reply_to_message_id: null,
    target_attachment_ids: [],
  };
  const sent = await session.client.rpc("send_text_message_idempotent", args);
  const row = firstRow(sent.data);
  if (!expected) {
    if (row?.id) {
      await deleteTextProbe(session.client, row.id);
      fail(`text mutation unexpectedly allowed for ${name}.`);
    }
    if (!sent.error) fail(`text mutation denial returned neither data nor an error for ${name}.`);
    return;
  }
  if (sent.error || !row?.id) fail(`text INSERT failed for ${name}.`);
  let replyId;
  try {
    const reaction = await session.client.rpc("set_message_reaction", { target_message_id: row.id, target_emoji: "RLS_PROBE", target_reacted: true });
    if (reaction.error) fail(`text reaction INSERT failed for ${name}.`);
    const removedReaction = await session.client.rpc("set_message_reaction", { target_message_id: row.id, target_emoji: "RLS_PROBE", target_reacted: false });
    if (removedReaction.error) fail(`text reaction DELETE failed for ${name}.`);
    const reply = await session.client.rpc("send_text_message_idempotent", { ...args, message_body: `[RLS reply ${clientMessageId}]`, target_client_message_id: crypto.randomUUID(), target_reply_to_message_id: row.id });
    replyId = firstRow(reply.data)?.id;
    if (reply.error || !replyId) fail(`text reply INSERT failed for ${name}.`);
    const edited = await session.client.rpc("edit_message_with_version", { target_message_id: row.id, next_body: `[RLS edited ${clientMessageId}]`, expected_edited_at: null });
    if (edited.error || !firstRow(edited.data)?.id) fail(`text UPDATE failed for ${name}.`);
  } finally {
    await deleteTextProbe(session.client, replyId);
    await deleteTextProbe(session.client, row.id);
  }
}

async function deleteDmProbe(client, id) {
  if (!id) return;
  await client.rpc("delete_direct_message", { target_message_id: id });
}

async function runDmMutationProbe(name, session, expected) {
  const clientMessageId = crypto.randomUUID();
  const sent = await session.client.rpc("send_direct_message_v3", {
    target_conversation_id: process.env[matrix.fixtures.dmConversationId],
    message_body: `[RLS DM probe ${clientMessageId}]`,
    target_client_message_id: clientMessageId,
    target_reply_to_message_id: null,
    target_attachments: [],
  });
  const row = firstRow(sent.data);
  if (!expected) {
    if (row?.id) {
      await deleteDmProbe(session.client, row.id);
      fail(`DM mutation unexpectedly allowed for ${name}.`);
    }
    if (!sent.error) fail(`DM mutation denial returned neither data nor an error for ${name}.`);
    return;
  }
  if (sent.error || !row?.id) fail(`DM INSERT failed for ${name}.`);
  try {
    const edited = await session.client.rpc("edit_direct_message", { target_message_id: row.id, message_body: `[RLS DM edited ${clientMessageId}]` });
    if (edited.error || !firstRow(edited.data)?.id) fail(`DM UPDATE failed for ${name}.`);
  } finally {
    await deleteDmProbe(session.client, row.id);
  }
}

async function runSettingsProbe(name, session, ownerId) {
  const { data: ownRows, error: ownError } = await session.client.from("user_settings").select("user_id,schema_version,theme_mode,notification_settings").eq("user_id", session.user.id).limit(1);
  if (ownError || ownRows?.length !== 1) fail(`own settings fixture is missing for ${name}.`);
  const own = ownRows[0];
  const { data: foreign, error: foreignError } = await session.client.from("user_settings").select("user_id").eq("user_id", ownerId).limit(1);
  if (name !== "owner" && (foreignError ? !isDenied(foreignError) : foreign?.length !== 0)) fail(`cross-user settings leaked to ${name}.`);
  const nextTheme = own.theme_mode === "dark" ? "light" : "dark";
  const update = await session.client.from("user_settings").update({ theme_mode: nextTheme }).eq("user_id", session.user.id).select("user_id");
  if (update.error || update.data?.length !== 1) fail(`own settings UPDATE failed for ${name}.`);
  const restore = await session.client.from("user_settings").update({ theme_mode: own.theme_mode }).eq("user_id", session.user.id);
  if (restore.error) fail(`own settings restore failed for ${name}.`);
}

async function runRadioListenerProbe(name, session, expected) {
  const result = await session.client.rpc("join_current_user_radio_listener", { target_session_id: process.env[matrix.fixtures.radioSessionId] });
  const allowed = !result.error && Boolean(firstRow(result.data));
  if (allowed) await session.client.rpc("leave_current_user_radio_listener", { target_session_id: process.env[matrix.fixtures.radioSessionId] });
  if (allowed !== expected) fail(`Radio listener INSERT/DELETE mismatch for ${name}; expected ${expected}.`);
}

async function runPodcastCommentProbe(name, session, expected) {
  const inserted = await session.client.from("podcast_episode_comments").insert({
    episode_id: process.env[matrix.fixtures.podcastEpisodeId],
    author_id: session.user.id,
    body: `[RLS podcast probe ${crypto.randomUUID()}]`,
  }).select("id").limit(1);
  const row = inserted.data?.[0];
  if (row?.id) await session.client.from("podcast_episode_comments").delete().eq("id", row.id);
  const allowed = !inserted.error && Boolean(row?.id);
  if (allowed !== expected) fail(`Podcast comment INSERT/DELETE mismatch for ${name}; expected ${expected}.`);
}

async function runMutationMatrix(actors) {
  const suites = Object.fromEntries(matrix.mutationSuites.map((suite) => [suite.id, suite]));
  const ownerId = actors.get("owner").user.id;
  for (const [name, session] of actors) {
    if (!session.user) continue;
    if (suites.text_message_crud_reply_reaction) await runTextMutationProbe(name, session, suites.text_message_crud_reply_reaction.allow.includes(name));
    if (suites.dm_message_crud) await runDmMutationProbe(name, session, suites.dm_message_crud.allow.includes(name));
    if (suites.settings_own_update_cross_user_deny) await runSettingsProbe(name, session, ownerId);
    if (suites.radio_listener_join_leave) await runRadioListenerProbe(name, session, suites.radio_listener_join_leave.allow.includes(name));
    if (suites.podcast_comment_create_delete) await runPodcastCommentProbe(name, session, suites.podcast_comment_create_delete.allow.includes(name));
  }
  pass("V1 Text/DM/settings INSERT, UPDATE, and DELETE probes");
}

if (!shouldRun) {
  console.log("Hosted V1 Core RLS matrix requires --run plus STAGING_ONLY and ALLOW_EPHEMERAL_WRITES confirmations.");
  console.log(`Required configuration names: ${requiredNames.join(", ")}`);
  console.log(`Actors: ${Object.keys(matrix.actors).join(", ")}`);
  console.log(`Coverage: ${matrix.coverage.domains.join(", ")} / ${matrix.coverage.operations.join(", ")}`);
  console.log("No database, Storage, Auth, or Realtime connection was made and no values were printed.");
  process.exit(0);
}

validateConfiguration();
const actors = await authenticateActors();
try {
  await verifyRoleFixtures(actors);
  await runReadMatrix(actors);
  await runProfileMatrix(actors);
  await runStorageMatrix(actors);
  await runRealtimeMatrix(actors);
  await runMutationMatrix(actors);
} finally {
  await signOutActors(actors);
}
console.log("Hosted V1 Core RLS role/content matrix passed. Output contains labels only; no IDs, credentials, tokens, URLs, or content were printed.");
