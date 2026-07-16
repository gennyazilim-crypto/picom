import { readFileSync } from "node:fs";

// Task 051 — CI validation for the governed event taxonomy.
//
// Enforces that the canonical registry (event-registry.json) and the typed runtime
// schema (eventSchema.ts) never drift, that every property is PII-classified, that no
// collectable property collides with the SENSITIVE blocklist, and that governance
// metadata (owner/status/version) and legacy mappings are complete. This is a real
// gate: it fails CI on any uncontrolled or mis-classified event.

const read = (path) => readFileSync(path, "utf8");
const registry = JSON.parse(read("src/services/analytics/event-registry.json"));
const schemaSrc = read("src/services/analytics/eventSchema.ts");

const errors = [];
const err = (msg) => errors.push(msg);

// --- Parse ALLOWED_METADATA from eventSchema.ts (the runtime source of truth) ---
const allowedBlock = schemaSrc.match(/ALLOWED_METADATA[^=]*=\s*{([\s\S]*?)};/);
if (!allowedBlock) {
  err("could not locate ALLOWED_METADATA in eventSchema.ts");
}
const schemaEvents = {};
if (allowedBlock) {
  const entryRe = /(\w+):\s*\[([^\]]*)\]/g;
  let m;
  while ((m = entryRe.exec(allowedBlock[1])) !== null) {
    const keys = m[2]
      .split(",")
      .map((s) => s.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
    schemaEvents[m[1]] = keys;
  }
}

// --- Parse the SENSITIVE blocklist regex from eventSchema.ts ---
const sensitiveMatch = schemaSrc.match(/SENSITIVE_KEY\s*=\s*(\/[^\n]+?\/[a-z]*)/);
let sensitive = null;
if (!sensitiveMatch) {
  err("could not locate SENSITIVE_KEY regex in eventSchema.ts");
} else {
  const body = sensitiveMatch[1].replace(/^\//, "").replace(/\/([a-z]*)$/, "");
  const flags = (sensitiveMatch[1].match(/\/([a-z]*)$/) || [, ""])[1];
  sensitive = new RegExp(body, flags);
}

const namePattern = new RegExp(registry.namePattern);
const activeEvents = registry.events.filter((e) => e.status === "active");
const registryActiveNames = new Set(activeEvents.map((e) => e.name));

// --- Rule 1: canonical naming for events + property keys ---
for (const event of registry.events) {
  if (!namePattern.test(event.name)) err(`event name not canonical snake_case: "${event.name}"`);
  for (const key of Object.keys(event.properties)) {
    if (!namePattern.test(toSnake(key))) err(`property key not canonical: ${event.name}.${key}`);
  }
}

// --- Rule 2: active registry <-> eventSchema parity (no drift) ---
for (const name of Object.keys(schemaEvents)) {
  if (!registryActiveNames.has(name)) err(`eventSchema event "${name}" is not an active registry event (uncontrolled event)`);
}
for (const event of activeEvents) {
  if (!(event.name in schemaEvents)) {
    err(`active registry event "${event.name}" is missing from eventSchema ALLOWED_METADATA`);
    continue;
  }
  const schemaKeys = new Set(schemaEvents[event.name]);
  const regKeys = new Set(Object.keys(event.properties));
  for (const k of schemaKeys) if (!regKeys.has(k)) err(`"${event.name}": key "${k}" in eventSchema but not registry`);
  for (const k of regKeys) if (!schemaKeys.has(k)) err(`"${event.name}": key "${k}" in registry but not eventSchema`);
}

// --- Rule 3: PII classification present + no forbidden/sensitive collectable key ---
for (const event of registry.events) {
  for (const [key, spec] of Object.entries(event.properties)) {
    if (!registry.piiClasses.includes(spec.pii)) err(`${event.name}.${key}: invalid pii class "${spec.pii}"`);
    if (spec.pii === "forbidden") err(`${event.name}.${key}: forbidden data must never be a collectable property`);
    if (event.status === "active" && sensitive && sensitive.test(key)) {
      err(`${event.name}.${key}: property key collides with the SENSITIVE blocklist and would be silently stripped`);
    }
  }
}

// --- Rule 4: governance metadata completeness ---
const statuses = new Set(["active", "deprecated", "proposed"]);
for (const event of registry.events) {
  if (!registry.owners.includes(event.owner)) err(`${event.name}: unknown owner "${event.owner}"`);
  if (!statuses.has(event.status)) err(`${event.name}: invalid status "${event.status}"`);
  if (typeof event.since !== "number") err(`${event.name}: missing "since" version`);
  if (event.status === "deprecated" && !event.replacedBy) err(`${event.name}: deprecated event must set replacedBy`);
}

// --- Rule 5: legacy mapping completeness ---
for (const entry of registry.legacyMap) {
  const mapped = entry.replacedBy || entry.proposedName;
  if (!mapped) err(`legacy "${entry.legacy}": must set replacedBy or proposedName`);
  if (entry.replacedBy && !registry.events.find((e) => e.name === entry.replacedBy)) {
    err(`legacy "${entry.legacy}": replacedBy "${entry.replacedBy}" is not a canonical event`);
  }
}

// --- Rule 6: the legacy service bridges into the canonical queue (call sites wired) ---
const legacySvc = read("src/services/analyticsService.ts");
if (!legacySvc.includes("analyticsQueue.enqueue") || !legacySvc.includes("CANONICAL_BRIDGE")) {
  err("analyticsService.ts must bridge legacy events into analyticsQueue (CANONICAL_BRIDGE + enqueue)");
}
if (/releaseTrack/.test(read("src/services/analytics/eventSchema.ts")) && legacySvc.includes('releaseChannel: ')) {
  // legacy metadata key may exist internally, but the bridge must map it to releaseTrack
  if (!legacySvc.includes("releaseTrack")) err("bridge must map releaseChannel -> releaseTrack");
}

function toSnake(s) {
  return s.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

if (errors.length) {
  console.error("Event taxonomy validation FAILED:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(`PASS: ${registry.events.length} registry events, ${Object.keys(schemaEvents).length} schema events in lockstep`);
console.log(`PASS: all properties PII-classified; no SENSITIVE-key collisions`);
console.log(`PASS: governance metadata complete; ${registry.legacyMap.length} legacy events mapped`);
console.log("Event taxonomy governance contract passed.");
