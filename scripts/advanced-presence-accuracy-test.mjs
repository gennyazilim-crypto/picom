import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync("src/utils/presenceAccuracy.ts", "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { aggregatePresenceEntries, isFreshPresence, PRESENCE_STALE_AFTER_MS } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

const nowMs = Date.UTC(2026, 6, 10, 12);
const entry = (overrides = {}) => ({ userId: "user", displayName: "User", avatarUrl: null, status: "online", lastSeen: new Date(nowMs - 1_000).toISOString(), ...overrides });

assert.deepEqual(aggregatePresenceEntries([entry({ status: "offline" })], nowMs), {}, "invisible/offline sessions must not appear online");
assert.deepEqual(aggregatePresenceEntries([entry({ lastSeen: new Date(nowMs - PRESENCE_STALE_AFTER_MS - 1).toISOString() })], nowMs), {}, "stale sessions must be removed");
assert.equal(isFreshPresence("invalid", nowMs), false);
assert.equal(isFreshPresence(new Date(nowMs + 10 * 60_000).toISOString(), nowMs), false, "unreasonable future timestamps must be rejected");

const aggregated = aggregatePresenceEntries([
  entry({ status: "idle", lastSeen: new Date(nowMs - 20_000).toISOString() }),
  entry({ status: "online", lastSeen: new Date(nowMs - 5_000).toISOString() }),
  entry({ userId: "other", status: "dnd" }),
], nowMs);
assert.equal(aggregated.user.status, "online", "freshest visible session should win");
assert.equal(aggregated.other.status, "dnd");

const hook = readFileSync("src/hooks/useSupabasePresenceChannel.ts", "utf8");
for (const marker of ["PRESENCE_HEARTBEAT_MS", "prunePresenceMap", "channel.untrack()", "visibilitychange", "removeChannel(channel)"]) {
  assert.ok(hook.includes(marker), `missing presence lifecycle marker: ${marker}`);
}

console.log("Advanced presence accuracy tests passed.");
