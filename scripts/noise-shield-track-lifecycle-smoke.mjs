import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const servicePath = path.join(root, "src/services/voice/microphoneTrackLifecycleService.ts");
const voicePath = path.join(root, "src/services/voiceService.ts");
const source = fs.readFileSync(servicePath, "utf8");
const voiceSource = fs.readFileSync(voicePath, "utf8");

const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  fileName: servicePath,
}).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
const { createMicrophoneTrackLifecycleManager } = await import(moduleUrl);

const manager = createMicrophoneTrackLifecycleManager();
const stopped = [];
const track = (id) => ({
  id,
  mediaStreamTrack: {
    id: `media-${id}`,
    readyState: "live",
    stop: () => stopped.push(id),
  },
});

const first = track("microphone-one");
assert.equal(manager.adoptTrack(first, "microphone", "initial_attach"), "adopted");
assert.equal(manager.adoptTrack(first, "microphone", "initial_attach"), "duplicate");
assert.equal(manager.markProcessorAttached(first.id), true);
assert.equal(manager.markProcessorAttached(first.id), false);

let detached = 0;
await manager.prepareProcessorReplacement(async () => { detached += 1; });
assert.equal(detached, 1);

const second = track("microphone-two");
assert.equal(manager.adoptTrack(second, "microphone", "device_switch"), "adopted");
assert.deepEqual(stopped, ["microphone-one"]);
assert.equal(manager.adoptTrack(track("screen-share"), "screen-share", "initial_attach"), "rejected");
assert.equal(manager.adoptTrack(track("radio"), "radio", "initial_attach"), "rejected");
assert.equal(manager.adoptTrack(track("podcast"), "podcast", "initial_attach"), "rejected");

manager.noteDeviceState("private-hardware-id", true);
assert.notEqual(manager.getSnapshot().selectedDeviceKey, "private-hardware-id");
manager.notePermission("denied");
manager.notePermission("granted");
manager.noteFallback();

const order = [];
await Promise.all([
  manager.runExclusive("reconnect", async () => { order.push("first-start"); await Promise.resolve(); order.push("first-end"); }),
  manager.runExclusive("device_switch", async () => { order.push("second"); }),
]);
assert.deepEqual(order, ["first-start", "first-end", "second"]);

let disposed = 0;
assert.equal(await manager.cleanup("room_cleanup", async () => { disposed += 1; }, true, "not-current"), false);
assert.equal(disposed, 0);
assert.equal(await manager.cleanup("room_cleanup", async () => { disposed += 1; }, true, second.id), true);
assert.equal(disposed, 1);
assert.ok(stopped.includes("microphone-two"));

const shutdownManager = createMicrophoneTrackLifecycleManager();
const shutdownTrack = track("shutdown-track");
shutdownManager.adoptTrack(shutdownTrack, "microphone", "initial_attach");
const handlers = new Set();
const fakeWindow = {
  addEventListener: (name, handler) => { if (name === "beforeunload") handlers.add(handler); },
  removeEventListener: (_name, handler) => handlers.delete(handler),
};
let shutdownDisposed = 0;
const unbindOne = shutdownManager.bindShutdown(() => { shutdownDisposed += 1; }, fakeWindow);
shutdownManager.bindShutdown(() => { shutdownDisposed += 1; }, fakeWindow);
assert.equal(handlers.size, 1);
handlers.forEach((handler) => handler());
await Promise.resolve();
assert.equal(shutdownDisposed, 1);
assert.ok(stopped.includes("shutdown-track"));
unbindOne();
assert.equal(handlers.size, 0);

for (let index = 0; index < 80; index += 1) manager.noteFallback();
assert.ok(manager.getSnapshot().events.length <= 64);
assert.equal(manager.getSnapshot().pendingOperations, 0);

assert.match(voiceSource, /microphoneTrackLifecycleService\.runExclusive/);
assert.match(voiceSource, /"room_disconnected"/);
assert.match(voiceSource, /"room_cleanup"/);
assert.match(voiceSource, /bindShutdown/);
assert.match(voiceSource, /"device_switch"/);
assert.match(voiceSource, /"reconnect"/);
assert.match(voiceSource, /"mode_switch"/);
assert.equal((voiceSource.match(/subscribePreferences\(/g) ?? []).length, 1);
assert.doesNotMatch(voiceSource, /applyEnhancedToTrack\([^,]+,\s*"screen-share"/);

console.log("Noise Shield microphone track lifecycle smoke test passed.");
