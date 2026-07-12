import { createRequire } from "node:module";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const { OAuthAttemptManager, ProtectedAuthStore } = require("../dist-electron/oauthFoundation.cjs");
const validators = require("../dist-electron/ipcPayloadValidation.cjs");
const directory = await mkdtemp(path.join(os.tmpdir(), "picom-oauth-"));
const file = path.join(directory, "auth.bin");
const protection = {
  available: true,
  backend: "test-protected",
  encryptString: (value) => Buffer.from(value, "utf8").reverse(),
  decryptString: (value) => Buffer.from(value).reverse().toString("utf8"),
};

try {
  const store = new ProtectedAuthStore(file, protection);
  const manager = new OAuthAttemptManager(store);
  const attempt = await manager.start("google", "sign_in");
  const callbackUrl = new URL(attempt.redirectUrl);
  callbackUrl.searchParams.set("code", "abcdefgh12345678");
  const callback = validators.parseOAuthCallbackUrl(callbackUrl.href);
  if (!callback) throw new Error("Valid callback rejected.");

  const mismatchUrl = new URL(callbackUrl.href);
  mismatchUrl.searchParams.set("state", "x".repeat(43));
  const mismatch = validators.parseOAuthCallbackUrl(mismatchUrl.href);
  const mismatchResult = mismatch ? await manager.completeCallback(mismatch) : null;
  if (!mismatchResult || mismatchResult.ok || mismatchResult.error !== "OAUTH_CALLBACK_STATE_MISMATCH") throw new Error("State mismatch accepted.");

  const completed = await manager.completeCallback(callback);
  if (!completed.ok) throw new Error("Valid callback failed.");
  const replay = await manager.completeCallback(callback);
  if (replay.ok || replay.error !== "OAUTH_CALLBACK_REPLAYED") throw new Error("Replay accepted.");

  const restored = new OAuthAttemptManager(new ProtectedAuthStore(file, protection));
  const pending = await restored.getPendingResult();
  if (!pending || pending.resultId !== completed.result.resultId) throw new Error("Cold-start result missing.");
  if ((await readFile(file, "utf8")).includes("abcdefgh12345678")) throw new Error("Code persisted in plaintext.");
  if (!(await restored.acknowledge(pending.resultId)) || await restored.getPendingResult()) throw new Error("Acknowledgement failed.");

  const restoredStore = new ProtectedAuthStore(file, protection);
  await restoredStore.setItem("sb-local-auth-token", "refresh-token-fixture");
  if ((await readFile(file, "utf8")).includes("refresh-token-fixture")) throw new Error("Session persisted in plaintext.");
  if ((await restoredStore.getItem("sb-local-auth-token")) !== "refresh-token-fixture") throw new Error("Session restore failed.");
  await restoredStore.removeItem("sb-local-auth-token");
  if (await restoredStore.getItem("sb-local-auth-token")) throw new Error("Logout removal failed.");

  let now = 1000;
  const expiring = new OAuthAttemptManager(new ProtectedAuthStore(path.join(directory, "expire.bin"), protection), () => now);
  const expiringAttempt = await expiring.start("apple", "sign_in");
  const expiredUrl = new URL(expiringAttempt.redirectUrl);
  expiredUrl.searchParams.set("code", "abcdefgh87654321");
  const expiredCallback = validators.parseOAuthCallbackUrl(expiredUrl.href);
  now += 11 * 60 * 1000;
  const expired = expiredCallback ? await expiring.completeCallback(expiredCallback) : null;
  if (!expired || expired.ok || expired.error !== "OAUTH_CALLBACK_EXPIRED") throw new Error("Expired callback accepted.");

  const cancelManager = new OAuthAttemptManager(new ProtectedAuthStore(path.join(directory, "cancel.bin"), protection));
  const cancelAttempt = await cancelManager.start("google", "link");
  if (!(await cancelManager.cancel(cancelAttempt.attemptId))) throw new Error("Cancellation failed.");

  const memory = new ProtectedAuthStore(path.join(directory, "unused.bin"), { ...protection, available: false, backend: "unavailable" });
  if (memory.getStatus().persistent) throw new Error("Memory fallback claimed persistence.");
  await memory.setItem("sb-memory-auth-token", "memory-only");
  if ((await memory.getItem("sb-memory-auth-token")) !== "memory-only") throw new Error("Memory fallback failed.");

  for (const invalid of [{}, { provider: "google", purpose: "unknown" }, { provider: "unknown", purpose: "sign_in" }]) {
    if (validators.parseOAuthAttemptStartPayload(invalid)) throw new Error("Invalid IPC payload accepted.");
  }
  console.log("Electron OAuth replay, expiry, cold-start, and protected-storage smoke passed.");
} finally {
  await rm(directory, { recursive: true, force: true });
}
