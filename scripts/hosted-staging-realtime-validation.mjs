import { createClient } from "@supabase/supabase-js";

const shouldRun = process.argv.includes("--run");
const requiredNames = [
  "PICOM_REALTIME_STAGING_URL",
  "PICOM_REALTIME_STAGING_ANON_KEY",
  "PICOM_REALTIME_STAGING_CONFIRM",
  "PICOM_REALTIME_CLIENT_A_EMAIL",
  "PICOM_REALTIME_CLIENT_A_PASSWORD",
  "PICOM_REALTIME_CLIENT_B_EMAIL",
  "PICOM_REALTIME_CLIENT_B_PASSWORD",
  "PICOM_REALTIME_COMMUNITY_ID",
  "PICOM_REALTIME_CHANNEL_ID",
];
const missing = requiredNames.filter((name) => !process.env[name]?.trim());
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const runId = `picom-realtime-${Date.now()}-${crypto.randomUUID()}`;
const eventCounts = {
  a: { INSERT: 0, UPDATE: 0, DELETE: 0 },
  b: { INSERT: 0, UPDATE: 0, DELETE: 0 },
};

function fail(message) { throw new Error(`Hosted staging Realtime validation failed: ${message}`); }
function pass(message) { console.log(`OK ${message}`); }

async function waitFor(predicate, label, timeoutMs = 20_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) return;
    await delay(100);
  }
  fail(`timeout waiting for ${label}.`);
}

function validateConfiguration() {
  if (missing.length) fail(`missing ${missing.join(", ")}. Values were not printed.`);
  if (process.env.PICOM_REALTIME_STAGING_CONFIRM !== "STAGING_ONLY") fail("PICOM_REALTIME_STAGING_CONFIRM must equal STAGING_ONLY.");
  if (/service[_-]?role|sb_secret_/i.test(process.env.PICOM_REALTIME_STAGING_ANON_KEY)) fail("key must be anon/publishable, not service-role.");
  let url;
  try { url = new URL(process.env.PICOM_REALTIME_STAGING_URL); } catch { fail("staging URL is invalid."); }
  if (url.protocol !== "https:" || url.username || url.password) fail("staging URL must be credential-free HTTPS.");
}

function createStagingClient() {
  return createClient(process.env.PICOM_REALTIME_STAGING_URL, process.env.PICOM_REALTIME_STAGING_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    realtime: { params: { eventsPerSecond: 10 } },
  });
}

async function authenticate(client, label, emailName, passwordName) {
  const { data, error } = await client.auth.signInWithPassword({
    email: process.env[emailName],
    password: process.env[passwordName],
  });
  if (error || !data.user) fail(`${label} synthetic account authentication failed.`);
  return data.user.id;
}

function subscribe(channel, label, onSubscribed) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} subscription timed out.`)), 20_000);
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        onSubscribed?.();
        clearTimeout(timer);
        resolve();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        clearTimeout(timer);
        reject(new Error(`${label} subscription failed with ${status}.`));
      }
    });
  });
}

function messageChannel(client, clientLabel, counter, messageIdRef, statusCounter) {
  return client
    .channel(`room:community:${process.env.PICOM_REALTIME_COMMUNITY_ID}:channel:${process.env.PICOM_REALTIME_CHANNEL_ID}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `channel_id=eq.${process.env.PICOM_REALTIME_CHANNEL_ID}` }, (payload) => {
      const candidateId = payload.eventType === "DELETE" ? payload.old?.id : payload.new?.id;
      if (!messageIdRef.value || candidateId !== messageIdRef.value) return;
      counter[payload.eventType] += 1;
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") statusCounter.value += 1;
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") fail(`${clientLabel} message subscription entered ${status}.`);
    });
}

if (!shouldRun) {
  console.log("Hosted staging Realtime runner requires --run plus explicit STAGING_ONLY confirmation.");
  console.log(`Required configuration names: ${requiredNames.join(", ")}`);
  console.log("No network connection was made and no credential values were printed.");
  process.exit(0);
}

validateConfiguration();
const clientA = createStagingClient();
const clientB = createStagingClient();
const channelsA = [];
const channelsB = [];
const messageIdRef = { value: "" };
const statusA = { value: 0 };
const statusB = { value: 0 };
let userA = "";
let userB = "";

try {
  userA = await authenticate(clientA, "client A", "PICOM_REALTIME_CLIENT_A_EMAIL", "PICOM_REALTIME_CLIENT_A_PASSWORD");
  userB = await authenticate(clientB, "client B", "PICOM_REALTIME_CLIENT_B_EMAIL", "PICOM_REALTIME_CLIENT_B_PASSWORD");
  if (userA === userB) fail("two distinct synthetic users are required.");
  pass("two distinct authenticated clients");

  const messagesA = messageChannel(clientA, "client A", eventCounts.a, messageIdRef, statusA);
  const messagesB = messageChannel(clientB, "client B", eventCounts.b, messageIdRef, statusB);
  channelsA.push(messagesA); channelsB.push(messagesB);
  await waitFor(() => statusA.value >= 1 && statusB.value >= 1, "message subscriptions");

  let typingReceived = 0;
  let typingStatusA = 0;
  let typingStatusB = 0;
  const typingTopic = `typing:community:${process.env.PICOM_REALTIME_COMMUNITY_ID}:channel:${process.env.PICOM_REALTIME_CHANNEL_ID}`;
  const typingA = clientA.channel(typingTopic, { config: { private: true, broadcast: { self: false } } });
  const typingB = clientB
    .channel(typingTopic, { config: { private: true, broadcast: { self: false } } })
    .on("broadcast", { event: "typing" }, ({ payload }) => {
      if (payload?.runId === runId && payload?.userId === userA) typingReceived += 1;
    });
  channelsA.push(typingA); channelsB.push(typingB);
  await Promise.all([
    subscribe(typingA, "client A typing", () => { typingStatusA += 1; }),
    subscribe(typingB, "client B typing", () => { typingStatusB += 1; }),
  ]);

  let presenceAReady = false;
  let presenceBReady = false;
  const presenceTopic = `presence:community:${process.env.PICOM_REALTIME_COMMUNITY_ID}`;
  const presenceA = clientA
    .channel(presenceTopic, { config: { private: true, presence: { key: userA } } })
    .on("presence", { event: "sync" }, () => {
      const keys = Object.keys(presenceA.presenceState());
      presenceAReady = keys.includes(userA) && keys.includes(userB);
    });
  const presenceB = clientB
    .channel(presenceTopic, { config: { private: true, presence: { key: userB } } })
    .on("presence", { event: "sync" }, () => {
      const keys = Object.keys(presenceB.presenceState());
      presenceBReady = keys.includes(userA) && keys.includes(userB);
    });
  channelsA.push(presenceA); channelsB.push(presenceB);
  await Promise.all([
    subscribe(presenceA, "client A presence", () => void presenceA.track({ userId: userA, status: "online", runId })),
    subscribe(presenceB, "client B presence", () => void presenceB.track({ userId: userB, status: "online", runId })),
  ]);
  await waitFor(() => presenceAReady && presenceBReady, "two-client presence sync");
  pass("typing and two-client presence subscriptions");

  const inserted = await clientA.from("messages").insert({
    community_id: process.env.PICOM_REALTIME_COMMUNITY_ID,
    channel_id: process.env.PICOM_REALTIME_CHANNEL_ID,
    author_id: userA,
    body: "Picom staging realtime validation message.",
    client_message_id: runId,
  }).select("id").single();
  if (inserted.error || !inserted.data?.id) fail(`message insert failed with ${inserted.error?.code ?? "no row"}.`);
  messageIdRef.value = inserted.data.id;
  await waitFor(() => eventCounts.a.INSERT === 1 && eventCounts.b.INSERT === 1, "single insert delivery");

  const updated = await clientA.from("messages").update({ body: "Picom staging realtime validation updated.", edited_at: new Date().toISOString() }).eq("id", messageIdRef.value);
  if (updated.error) fail(`message update failed with ${updated.error.code ?? "an error"}.`);
  await waitFor(() => eventCounts.a.UPDATE === 1 && eventCounts.b.UPDATE === 1, "single update delivery");

  await typingA.send({ type: "broadcast", event: "typing", payload: { runId, userId: userA, isTyping: true, sentAt: new Date().toISOString() } });
  await waitFor(() => typingReceived === 1, "typing delivery");

  clientB.realtime.disconnect();
  await delay(750);
  clientB.realtime.connect();
  await waitFor(() => statusB.value >= 2 && typingStatusB >= 2, "client B reconnect subscriptions", 30_000);
  await presenceB.track({ userId: userB, status: "online", runId });
  await typingA.send({ type: "broadcast", event: "typing", payload: { runId, userId: userA, isTyping: false, sentAt: new Date().toISOString() } });
  await waitFor(() => typingReceived === 2, "post-reconnect typing delivery");
  pass("client B reconnect and delivery recovery");

  const deleted = await clientA.from("messages").delete().eq("id", messageIdRef.value);
  if (deleted.error) fail(`message delete failed with ${deleted.error.code ?? "an error"}.`);
  await waitFor(() => eventCounts.a.DELETE === 1 && eventCounts.b.DELETE === 1, "single delete delivery");
  messageIdRef.value = "";
  await delay(750);

  for (const [label, counts] of Object.entries(eventCounts)) {
    if (counts.INSERT !== 1 || counts.UPDATE !== 1 || counts.DELETE !== 1) fail(`${label} received duplicate/missing message events.`);
  }
  if (typingReceived !== 2) fail("typing broadcast duplicated or was lost.");
  pass("insert/update/delete delivered exactly once to both clients");
} finally {
  if (messageIdRef.value && userA) await clientA.from("messages").delete().eq("id", messageIdRef.value);
  await Promise.all([...channelsA.map((channel) => clientA.removeChannel(channel)), ...channelsB.map((channel) => clientB.removeChannel(channel))]);
  if (clientA.getChannels().length || clientB.getChannels().length) fail("subscription cleanup left active channels.");
  await Promise.all([clientA.auth.signOut({ scope: "local" }), clientB.auth.signOut({ scope: "local" })]);
}

pass("subscription cleanup removed every staging channel");
console.log("Hosted staging Realtime validation passed without logging credentials, payload content, or identifiers.");
