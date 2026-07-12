import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const storeSource = await readFile(path.join(root, "src/stores/globalPresenceStore.ts"), "utf8");
const compiled = ts.transpileModule(storeSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const store = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

assert.equal(store.deriveGlobalPresenceSnapshot("online", "connected").publicStatus, "online");
assert.equal(store.deriveGlobalPresenceSnapshot("idle", "connected").label, "Idle");
assert.equal(store.deriveGlobalPresenceSnapshot("dnd", "connected").label, "Do Not Disturb");
assert.deepEqual(
  { label: store.deriveGlobalPresenceSnapshot("invisible", "connected").label, publicStatus: store.deriveGlobalPresenceSnapshot("invisible", "connected").publicStatus },
  { label: "Invisible", publicStatus: "offline" },
);
assert.equal(store.deriveGlobalPresenceSnapshot("online", "disconnected").label, "Offline");

const card = await readFile(path.join(root, "src/components/navigation/GlobalUserCard.tsx"), "utf8");
const menu = await readFile(path.join(root, "src/components/navigation/PresenceMenu.tsx"), "utf8");
const service = await readFile(path.join(root, "src/services/presence/globalPresenceService.ts"), "utf8");
const friendService = await readFile(path.join(root, "src/services/friends/friendPresenceService.ts"), "utf8");
const migration = await readFile(path.join(root, "supabase/migrations/20260712180000_global_presence_sessions.sql"), "utf8");
const app = await readFile(path.join(root, "src/App.tsx"), "utf8");

assert.match(card, /VerifiedBadge verification=\{currentUser\.verification\}/);
assert.match(card, /global-presence-dot is-\$\{presence\.dotStatus\}/);
for (const label of ["Online", "Idle", "Do Not Disturb", "Invisible"]) assert.match(menu, new RegExp(label));
assert.match(service, /set_my_presence_session/);
assert.match(service, /clear_my_presence_session/);
assert.doesNotMatch(friendService, /set_my_friend_presence/);
assert.match(migration, /user_presence_sessions/);
assert.match(migration, /bool_or\(session\.share_presence\)/);
assert.match(app, /globalPresenceService\.start\(userId\)/);
assert.match(app, /presencePreferenceService\.subscribe/);

console.log("Global user card and presence smoke PASS");
