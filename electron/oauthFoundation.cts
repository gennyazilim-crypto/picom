import { randomBytes, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

export type OAuthProvider = "google" | "apple" | "epic" | "steam";
export type OAuthPurpose = "sign_in" | "link";
export type OAuthCallbackEnvelope = Readonly<{
  attemptId: string;
  state: string;
  nonce: string;
  provider: OAuthProvider;
  purpose: OAuthPurpose;
  code?: string;
  error?: string;
}>;

export type OAuthFoundationError =
  | "OAUTH_ATTEMPT_NOT_FOUND"
  | "OAUTH_CALLBACK_STATE_MISMATCH"
  | "OAUTH_CALLBACK_EXPIRED"
  | "OAUTH_CALLBACK_REPLAYED"
  | "OAUTH_CALLBACK_INVALID"
  | "OAUTH_PROVIDER_CANCELLED"
  | "OAUTH_PROVIDER_ERROR"
  | "OAUTH_FOUNDATION_UNAVAILABLE";

export type OAuthCompletionResult = Readonly<{
  resultId: string;
  attemptId: string;
  provider: OAuthProvider;
  purpose: OAuthPurpose;
  status: "success" | "error";
  code?: string;
  error?: "OAUTH_PROVIDER_CANCELLED" | "OAUTH_PROVIDER_ERROR";
  receivedAt: number;
  expiresAt: number;
}>;

export type OAuthDelivery = OAuthCompletionResult | Readonly<{ status: "rejected"; error: OAuthFoundationError }>;
export type SecureStorageProtection = Readonly<{
  available: boolean;
  backend: string;
  encryptString: (value: string) => Buffer;
  decryptString: (value: Buffer) => string;
}>;
export type SecureStorageStatus = Readonly<{
  mode: "os_protected" | "memory_only";
  persistent: boolean;
  backend: string;
  reason?: "OS_PROTECTED_STORAGE_UNAVAILABLE";
}>;

const MAX_STORE_BYTES = 1024 * 1024;
const MAX_VALUE_LENGTH = 512 * 1024;
const OAUTH_STATE_KEY = "picom.internal.oauth-state";
const OAUTH_ATTEMPT_TTL_MS = 10 * 60 * 1000;
const OAUTH_RESULT_TTL_MS = 5 * 60 * 1000;
const OAUTH_CALLBACK_URL = "picom://auth/callback";

type StoredAttempt = Readonly<{
  version: 1;
  attemptId: string;
  provider: OAuthProvider;
  purpose: OAuthPurpose;
  state: string;
  nonce: string;
  startedAt: number;
  expiresAt: number;
  status: "pending" | "completed";
}>;
type StoredOAuthState = Readonly<{ attempt?: StoredAttempt; result?: OAuthCompletionResult }>;

function randomUrlSafe(bytes: number): string {
  return randomBytes(bytes).toString("base64url");
}
function randomIdentifier(): string {
  return randomBytes(16).toString("hex");
}
function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
function isProvider(value: unknown): value is OAuthProvider {
  return value === "google" || value === "apple" || value === "epic" || value === "steam";
}
function isPurpose(value: unknown): value is OAuthPurpose {
  return value === "sign_in" || value === "link";
}
function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{32}$/i.test(value);
}
function isStateValue(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{32,96}$/.test(value);
}
function parseAttempt(value: unknown): StoredAttempt | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    record.version !== 1 || !isIdentifier(record.attemptId) || !isProvider(record.provider) ||
    !isPurpose(record.purpose) || !isStateValue(record.state) || !isStateValue(record.nonce) ||
    typeof record.startedAt !== "number" || typeof record.expiresAt !== "number" ||
    (record.status !== "pending" && record.status !== "completed")
  ) return null;
  return record as StoredAttempt;
}
function parseResult(value: unknown): OAuthCompletionResult | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    !isIdentifier(record.resultId) || !isIdentifier(record.attemptId) || !isProvider(record.provider) ||
    !isPurpose(record.purpose) || (record.status !== "success" && record.status !== "error") ||
    typeof record.receivedAt !== "number" || typeof record.expiresAt !== "number"
  ) return null;
  if (record.status === "success") {
    if (typeof record.code !== "string" || !/^[a-zA-Z0-9._~-]{8,1024}$/.test(record.code) || record.error !== undefined) return null;
  } else if ((record.error !== "OAUTH_PROVIDER_CANCELLED" && record.error !== "OAUTH_PROVIDER_ERROR") || record.code !== undefined) {
    return null;
  }
  return record as OAuthCompletionResult;
}
function parseOAuthState(raw: string | null): StoredOAuthState {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const attempt = parseAttempt(parsed.attempt);
    const result = parseResult(parsed.result);
    return { attempt: attempt ?? undefined, result: result ?? undefined };
  } catch {
    return {};
  }
}

export class ProtectedAuthStore {
  private readonly values = new Map<string, string>();
  private loaded = false;
  private operation: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string, private readonly protection: SecureStorageProtection) {}

  getStatus(): SecureStorageStatus {
    return this.protection.available
      ? { mode: "os_protected", persistent: true, backend: this.protection.backend }
      : { mode: "memory_only", persistent: false, backend: this.protection.backend, reason: "OS_PROTECTED_STORAGE_UNAVAILABLE" };
  }
  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operation.then(operation, operation);
    this.operation = result.then(() => undefined, () => undefined);
    return result;
  }
  private async loadUnsafe(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    if (!this.protection.available) return;
    try {
      const encrypted = await fs.readFile(this.filePath);
      if (encrypted.length > MAX_STORE_BYTES) return;
      const parsed = JSON.parse(this.protection.decryptString(encrypted)) as unknown;
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return;
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (key.length <= 180 && typeof value === "string" && value.length <= MAX_VALUE_LENGTH) this.values.set(key, value);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") this.values.clear();
    }
  }
  private async persistUnsafe(): Promise<void> {
    if (!this.protection.available) return;
    const serialized = JSON.stringify(Object.fromEntries(this.values));
    if (Buffer.byteLength(serialized, "utf8") > MAX_STORE_BYTES) throw new Error("AUTH_STORAGE_LIMIT_EXCEEDED");
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, this.protection.encryptString(serialized), { mode: 0o600 });
    if (process.platform !== "win32") await fs.chmod(this.filePath, 0o600).catch(() => undefined);
  }
  getItem(key: string): Promise<string | null> {
    return this.enqueue(async () => {
      await this.loadUnsafe();
      return this.values.get(key) ?? null;
    });
  }
  setItem(key: string, value: string): Promise<void> {
    return this.enqueue(async () => {
      await this.loadUnsafe();
      if (value.length > MAX_VALUE_LENGTH) throw new Error("AUTH_STORAGE_VALUE_TOO_LARGE");
      this.values.set(key, value);
      await this.persistUnsafe();
    });
  }
  removeItem(key: string): Promise<void> {
    return this.enqueue(async () => {
      await this.loadUnsafe();
      this.values.delete(key);
      await this.persistUnsafe();
    });
  }
}

export class OAuthAttemptManager {
  constructor(private readonly storage: ProtectedAuthStore, private readonly now: () => number = () => Date.now()) {}

  private async readState(): Promise<StoredOAuthState> {
    return parseOAuthState(await this.storage.getItem(OAUTH_STATE_KEY));
  }
  private async writeState(state: StoredOAuthState): Promise<void> {
    if (!state.attempt && !state.result) {
      await this.storage.removeItem(OAUTH_STATE_KEY);
      return;
    }
    await this.storage.setItem(OAUTH_STATE_KEY, JSON.stringify(state));
  }
  async start(provider: OAuthProvider, purpose: OAuthPurpose): Promise<Readonly<{
    attemptId: string;
    provider: OAuthProvider;
    purpose: OAuthPurpose;
    redirectUrl: string;
    expiresAt: number;
    storage: SecureStorageStatus;
  }>> {
    const startedAt = this.now();
    const attempt: StoredAttempt = {
      version: 1,
      attemptId: randomIdentifier(),
      provider,
      purpose,
      state: randomUrlSafe(32),
      nonce: randomUrlSafe(32),
      startedAt,
      expiresAt: startedAt + OAUTH_ATTEMPT_TTL_MS,
      status: "pending",
    };
    await this.writeState({ attempt });
    const callback = new URL(OAUTH_CALLBACK_URL);
    callback.searchParams.set("attempt_id", attempt.attemptId);
    callback.searchParams.set("state", attempt.state);
    callback.searchParams.set("nonce", attempt.nonce);
    callback.searchParams.set("provider", attempt.provider);
    callback.searchParams.set("purpose", attempt.purpose);
    return {
      attemptId: attempt.attemptId,
      provider,
      purpose,
      redirectUrl: callback.href,
      expiresAt: attempt.expiresAt,
      storage: this.storage.getStatus(),
    };
  }
  async completeCallback(callback: OAuthCallbackEnvelope): Promise<
    { ok: true; result: OAuthCompletionResult } | { ok: false; error: OAuthFoundationError }
  > {
    const current = await this.readState();
    const attempt = current.attempt;
    if (!attempt) return { ok: false, error: "OAUTH_ATTEMPT_NOT_FOUND" };
    if (attempt.status === "completed") return { ok: false, error: "OAUTH_CALLBACK_REPLAYED" };
    if (this.now() > attempt.expiresAt) {
      await this.writeState({});
      return { ok: false, error: "OAUTH_CALLBACK_EXPIRED" };
    }
    if (
      callback.attemptId !== attempt.attemptId || callback.provider !== attempt.provider ||
      callback.purpose !== attempt.purpose || !safeEqual(callback.state, attempt.state) ||
      !safeEqual(callback.nonce, attempt.nonce)
    ) return { ok: false, error: "OAUTH_CALLBACK_STATE_MISMATCH" };

    const receivedAt = this.now();
    const result: OAuthCompletionResult = {
      resultId: randomIdentifier(),
      attemptId: attempt.attemptId,
      provider: attempt.provider,
      purpose: attempt.purpose,
      status: callback.code ? "success" : "error",
      code: callback.code,
      error: callback.code ? undefined : callback.error === "access_denied" ? "OAUTH_PROVIDER_CANCELLED" : "OAUTH_PROVIDER_ERROR",
      receivedAt,
      expiresAt: Math.min(attempt.expiresAt, receivedAt + OAUTH_RESULT_TTL_MS),
    };
    await this.writeState({ attempt: { ...attempt, status: "completed" }, result });
    return { ok: true, result };
  }
  async getPendingResult(): Promise<OAuthCompletionResult | null> {
    const current = await this.readState();
    if (!current.result) return null;
    if (this.now() > current.result.expiresAt) {
      await this.writeState({});
      return null;
    }
    return current.result;
  }
  async acknowledge(resultId: string): Promise<boolean> {
    const current = await this.readState();
    if (!current.result || current.result.resultId !== resultId) return false;
    await this.writeState({ attempt: current.attempt });
    return true;
  }
  async cancel(attemptId: string): Promise<boolean> {
    const current = await this.readState();
    if (!current.attempt || current.attempt.attemptId !== attemptId || current.attempt.status !== "pending") return false;
    await this.writeState({});
    return true;
  }
}
