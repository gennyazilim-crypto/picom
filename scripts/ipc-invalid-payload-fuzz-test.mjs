import fs from "node:fs";
import ts from "typescript";

const validationSource = fs.readFileSync("electron/ipcPayloadValidation.cts", "utf8");
const compiled = ts.transpileModule(validationSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const validators = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

const invalidValues = [undefined, null, true, false, 0, 1, -1, NaN, Infinity, {}, [], ["close"], () => undefined, Symbol("invalid")];
for (const value of invalidValues) {
  if (validators.isWindowAction(value)) throw new Error("Invalid window action was accepted");
  if (validators.isTrayStatus(value)) throw new Error("Invalid tray status was accepted");
  if (validators.normalizeExternalUrl(value) !== null) throw new Error("Invalid external URL value was accepted");
  if (validators.parseClipboardWritePayload(value) !== null) throw new Error("Invalid clipboard value was accepted");
  if (validators.isSafeDeepLink(value)) throw new Error("Invalid deep link value was accepted");
  if (validators.parseScreenCaptureListPayload(value) !== null) throw new Error("Invalid screen list payload was accepted");
  if (validators.parseScreenCaptureSelectionPayload(value) !== null) throw new Error("Invalid screen selection payload was accepted");
  if (validators.parseScreenCaptureCancelPayload(value) !== null) throw new Error("Invalid screen cancel payload was accepted");
}

for (const action of ["minimize", "maximize", "close"]) if (!validators.isWindowAction(action)) throw new Error(`Valid window action rejected: ${action}`);
for (const status of ["online", "idle", "dnd", "invisible"]) if (!validators.isTrayStatus(status)) throw new Error(`Valid tray status rejected: ${status}`);
for (const value of ["quit", "restore", "fullscreen", "CLOSE", " close ", "__proto__"]) if (validators.isWindowAction(value)) throw new Error(`Unsafe window action accepted: ${value}`);

for (const url of ["https://example.com/path?q=1", "http://127.0.0.1/status"]) if (!validators.normalizeExternalUrl(url)) throw new Error(`Safe URL rejected: ${url}`);
for (const url of ["javascript:alert(1)", "file:///etc/passwd", "data:text/html,test", "picom://settings", "shell:calc", "https://user:pass@example.com", "https://example.com/" + "a".repeat(2050), "not a url"]) {
  if (validators.normalizeExternalUrl(url) !== null) throw new Error(`Unsafe URL accepted: ${url.slice(0, 80)}`);
}

for (const value of invalidValues.concat([{}, { title: "" }, { title: 4 }, { body: "x" }, []])) {
  if (validators.parseNotificationPayload(value) !== null) throw new Error("Invalid notification payload accepted");
  if (validators.parseSaveTextPayload(value) !== null) throw new Error("Invalid save payload accepted");
}
const notification = validators.parseNotificationPayload({ title: " T".repeat(100), body: "B".repeat(400), silent: true, unexpected: "ignored" });
if (!notification || notification.title.length > 120 || (notification.body?.length ?? 0) > 240 || notification.silent !== true || "unexpected" in notification) throw new Error("Notification payload bounds failed");
const save = validators.parseSaveTextPayload({ defaultPath: "../bad:<name>?.json", content: "x".repeat(2 * 1024 * 1024 + 100), path: "C:/forbidden" });
if (!save || /[<>:"/\\|?*]/.test(save.defaultPath) || save.content.length !== 2 * 1024 * 1024 || "path" in save) throw new Error("Save payload bounds/path sanitization failed");
if (validators.parseClipboardWritePayload("x".repeat(validators.MAX_CLIPBOARD_TEXT_LENGTH + 10)).length !== validators.MAX_CLIPBOARD_TEXT_LENGTH) throw new Error("Clipboard payload was not bounded");

const captureRequestId = "123e4567-e89b-12d3-a456-426614174000";
if (!validators.parseScreenCaptureListPayload({ requestId: captureRequestId, userInitiated: true })) throw new Error("Safe screen list payload rejected");
if (!validators.parseScreenCaptureSelectionPayload({ requestId: captureRequestId, sourceId: "screen:0:0" })) throw new Error("Safe screen selection payload rejected");
if (!validators.parseScreenCaptureCancelPayload({ requestId: captureRequestId })) throw new Error("Safe screen cancel payload rejected");
for (const payload of [{ requestId: captureRequestId, userInitiated: false }, { requestId: "short", userInitiated: true }, { requestId: captureRequestId, sourceId: "file:///secret" }, { requestId: captureRequestId, sourceId: "screen:0:0", extra: true }]) {
  if (validators.parseScreenCaptureListPayload(payload) || validators.parseScreenCaptureSelectionPayload(payload) || validators.parseScreenCaptureCancelPayload(payload)) throw new Error("Unsafe screen capture payload accepted");
}

const safeOAuthCallback = "picom://auth/callback?attempt_id=0123456789abcdef0123456789abcdef&state=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa&nonce=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb&provider=google&purpose=sign_in&code=abcdefgh";
for (const link of ["picom://settings", "picom://friends", "picom://invite/ABC_123", "picom://community/community-1/channel/channel-2/message/message-3", safeOAuthCallback]) {
  if (!validators.isSafeDeepLink(link)) throw new Error(`Safe deep link rejected: ${link}`);
}
for (const link of ["picom://community/../secret", "picom://invite/a?token=x", "picom://community/x#fragment", "picom://auth/callback?code=abcdefgh", safeOAuthCallback + "&token=x", "https://example.com", "picom://unknown/value"]) {
  if (validators.isSafeDeepLink(link)) throw new Error(`Unsafe deep link accepted: ${link}`);
}

let seed = 0x311;
const nextRandom = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0x100000000);
const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:/?&=#%._-\\\u0000";
for (let index = 0; index < 1000; index += 1) {
  const length = Math.floor(nextRandom() * 280);
  let value = "";
  for (let cursor = 0; cursor < length; cursor += 1) value += alphabet[Math.floor(nextRandom() * alphabet.length)];
  for (const call of [validators.normalizeExternalUrl, validators.isSafeDeepLink, validators.parseClipboardWritePayload]) {
    try { call(value); } catch (error) { throw new Error(`Validator crashed during deterministic fuzz: ${error instanceof Error ? error.message : String(error)}`); }
  }
}

const main = fs.readFileSync("electron/main.cts", "utf8");
const preload = fs.readFileSync("electron/preload.cts", "utf8");
const channels = fs.readFileSync("electron/ipcChannels.cts", "utf8");
if (!main.includes('types: ["screen", "window"]') || !main.includes("screenCaptureGetSources, async (event, payload: unknown)")) throw new Error("Screen picker is not fixed-input/payload/sender-guarded");
for (const marker of ["parseScreenCaptureListPayload", "parseScreenCaptureSelectionPayload", "parseScreenCaptureCancelPayload", "screenCaptureSessions", "SCREEN_CAPTURE_SESSION_TTL_MS"]) if (!main.includes(marker)) throw new Error(`Secure screen picker contract missing: ${marker}`);
if (channels.includes("update") || preload.includes("update:")) throw new Error("Update IPC must remain absent until a frozen safe contract is approved");
for (const forbidden of ["child_process", "exec(", "spawn(", "shell.openPath", "fs.rm", "fs.unlink", "fs.readdir"]) {
  if (main.includes(forbidden)) throw new Error(`Forbidden native capability found in IPC main path: ${forbidden}`);
}

console.log("IPC invalid payload deterministic fuzz test passed.");
