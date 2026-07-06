#!/usr/bin/env node

// Development-only in-memory simulation for connecting users, joining realtime rooms,
// sending messages, typing events, presence updates, reconnects, and duplicate checks.

const DEFAULTS = {
  clients: 5,
  messagesPerClient: 3,
  delayMs: 10,
  communityId: "mock-community-load-test",
  channelId: "mock-channel-general",
  reconnectEvery: 3,
};

function parseArgs(argv) {
  const options = { ...DEFAULTS, dryRun: true };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--execute") {
      options.dryRun = false;
      continue;
    }

    const [rawKey, rawValue] = arg.replace(/^--/, "").split("=");
    if (!rawKey || rawValue == null) continue;

    if (rawKey === "clients") options.clients = Number(rawValue);
    if (rawKey === "messages" || rawKey === "messagesPerClient") options.messagesPerClient = Number(rawValue);
    if (rawKey === "delay" || rawKey === "delayMs") options.delayMs = Number(rawValue);
    if (rawKey === "community" || rawKey === "communityId") options.communityId = rawValue;
    if (rawKey === "channel" || rawKey === "channelId") options.channelId = rawValue;
    if (rawKey === "reconnectEvery") options.reconnectEvery = Number(rawValue);
  }

  return options;
}

function printHelp() {
  console.log(`Picom realtime load simulation

Safe development-only defaults:
  npm run realtime:load:simulate

Options:
  --clients=5
  --messages=3
  --delayMs=10
  --communityId=mock-community-load-test
  --channelId=mock-channel-general
  --reconnectEvery=3
  --execute

Notes:
  The default mode is an in-memory dry run. It does not connect to Supabase.
  --execute is reserved for future local Supabase adapter work and is blocked unless
  PICOM_REALTIME_LOAD_ALLOW_REMOTE=true is explicitly set.
`);
}

function assertSafeOptions(options) {
  const errors = [];

  if (!Number.isInteger(options.clients) || options.clients < 1 || options.clients > 250) {
    errors.push("--clients must be an integer between 1 and 250.");
  }

  if (!Number.isInteger(options.messagesPerClient) || options.messagesPerClient < 0 || options.messagesPerClient > 250) {
    errors.push("--messages must be an integer between 0 and 250.");
  }

  if (!Number.isInteger(options.delayMs) || options.delayMs < 0 || options.delayMs > 5000) {
    errors.push("--delayMs must be an integer between 0 and 5000.");
  }

  if (!options.communityId || !options.channelId) {
    errors.push("--communityId and --channelId are required.");
  }

  if (!options.dryRun && process.env.PICOM_REALTIME_LOAD_ALLOW_REMOTE !== "true") {
    errors.push("--execute is blocked by default. Set PICOM_REALTIME_LOAD_ALLOW_REMOTE=true only for local/staging development targets.");
  }

  if (process.env.NODE_ENV === "production" && process.env.PICOM_REALTIME_LOAD_ALLOW_REMOTE !== "true") {
    errors.push("Realtime load simulation is development-only and cannot run with NODE_ENV=production by default.");
  }

  if (errors.length > 0) {
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createClient(index) {
  return {
    id: `load-client-${String(index + 1).padStart(3, "0")}`,
    displayName: `Load Client ${index + 1}`,
    connected: false,
    joined: false,
    messagesSent: 0,
    reconnects: 0,
  };
}

function createEventId(parts) {
  return parts.join(":");
}

function rememberEvent(state, eventId) {
  if (state.seenEventIds.has(eventId)) {
    state.duplicateEvents += 1;
    return false;
  }

  state.seenEventIds.add(eventId);
  return true;
}

function record(state, type, payload) {
  state.events.push({
    type,
    timestamp: new Date().toISOString(),
    ...payload,
  });
}

async function simulate(options) {
  const clients = Array.from({ length: options.clients }, (_, index) => createClient(index));
  const state = {
    events: [],
    seenEventIds: new Set(),
    duplicateEvents: 0,
    messageEvents: 0,
    typingEvents: 0,
    presenceEvents: 0,
    reconnectEvents: 0,
  };

  for (const client of clients) {
    client.connected = true;
    record(state, "connect", { clientId: client.id });

    client.joined = true;
    record(state, "join_room", {
      clientId: client.id,
      communityId: options.communityId,
      channelId: options.channelId,
      rooms: [
        `room:community:${options.communityId}:channel:${options.channelId}`,
        `typing:community:${options.communityId}:channel:${options.channelId}`,
        `presence:community:${options.communityId}`,
      ],
    });

    state.presenceEvents += 1;
    record(state, "presence:update", {
      clientId: client.id,
      status: "online",
    });
  }

  for (let messageIndex = 0; messageIndex < options.messagesPerClient; messageIndex += 1) {
    for (const client of clients) {
      state.typingEvents += 2;
      record(state, "typing:start", { clientId: client.id, channelId: options.channelId });
      record(state, "typing:stop", { clientId: client.id, channelId: options.channelId });

      const clientMessageId = `${client.id}-msg-${messageIndex + 1}`;
      const eventId = createEventId(["message:new", options.communityId, options.channelId, clientMessageId]);

      if (rememberEvent(state, eventId)) {
        state.messageEvents += 1;
        client.messagesSent += 1;
        record(state, "message:new", {
          clientId: client.id,
          communityId: options.communityId,
          channelId: options.channelId,
          clientMessageId,
          body: `Load simulation message ${messageIndex + 1} from ${client.displayName}`,
        });
      }

      rememberEvent(state, eventId);

      if (options.reconnectEvery > 0 && client.messagesSent % options.reconnectEvery === 0) {
        client.reconnects += 1;
        state.reconnectEvents += 1;
        record(state, "disconnect", { clientId: client.id, reason: "simulated_reconnect" });
        record(state, "reconnect", { clientId: client.id, attempt: client.reconnects });
      }

      if (options.delayMs > 0) {
        await sleep(options.delayMs);
      }
    }
  }

  for (const client of clients) {
    record(state, "presence:update", {
      clientId: client.id,
      status: "offline",
    });
    state.presenceEvents += 1;
    record(state, "disconnect", { clientId: client.id, reason: "simulation_complete" });
  }

  return {
    mode: options.dryRun ? "dry_run_in_memory" : "remote_execution_blocked_placeholder",
    communityId: options.communityId,
    channelId: options.channelId,
    clients: clients.length,
    messagesPerClient: options.messagesPerClient,
    totalEvents: state.events.length,
    messageEvents: state.messageEvents,
    typingEvents: state.typingEvents,
    presenceEvents: state.presenceEvents,
    reconnectEvents: state.reconnectEvents,
    duplicateEventsPrevented: state.duplicateEvents,
    sampleEvents: state.events.slice(0, 10),
  };
}

const options = parseArgs(process.argv.slice(2));
if (options.help) {
  printHelp();
  process.exit(0);
}

assertSafeOptions(options);
const summary = await simulate(options);

console.log(JSON.stringify(summary, null, 2));
