import type { BotCredentialStatus, IssuedBotToken } from "../types/bots";
import { dataSourceService } from "./dataSourceService";

const STORAGE_KEY = "picom.botCredentials.mock.v1";
const RATE_LIMIT_PER_MINUTE = 60;

type BotCredentialRecord = Readonly<{
  botId: string;
  tokenPrefix: string;
  tokenHash: string;
  createdAt: string;
  revokedAt: string | null;
}>;

type CredentialResult<T> = Readonly<{ ok: true; data: T } | { ok: false; message: string }>;

function readRecords(): Record<string, BotCredentialRecord> {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, BotCredentialRecord>
      : {};
  } catch {
    return {};
  }
}

function writeRecords(records: Record<string, BotCredentialRecord>): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    return true;
  } catch {
    return false;
  }
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function statusFromRecord(botId: string, record?: BotCredentialRecord): BotCredentialStatus {
  return Object.freeze({
    botId,
    configured: Boolean(record),
    tokenPrefix: record?.tokenPrefix ?? null,
    createdAt: record?.createdAt ?? null,
    revokedAt: record?.revokedAt ?? null,
    rateLimitPerMinute: RATE_LIMIT_PER_MINUTE,
  });
}

export const botCredentialService = {
  getStatus(botId: string): BotCredentialStatus {
    return statusFromRecord(botId, readRecords()[botId]);
  },

  async issueTokenOnce(botId: string, canManage: boolean): Promise<CredentialResult<IssuedBotToken>> {
    if (!canManage) return { ok: false, message: "You do not have permission to manage bot credentials." };
    if (!dataSourceService.getStatus().isMock) return { ok: false, message: "Bot token issuance requires the future trusted Edge Function." };
    const records = readRecords();
    if (records[botId] && !records[botId].revokedAt) return { ok: false, message: "An active credential already exists for this bot. Raw tokens cannot be shown again." };

    const prefixBytes = crypto.getRandomValues(new Uint8Array(6));
    const secretBytes = crypto.getRandomValues(new Uint8Array(32));
    const tokenPrefix = bytesToBase64Url(prefixBytes);
    const rawToken = `picom_bot_${tokenPrefix}_${bytesToBase64Url(secretBytes)}`;
    const createdAt = new Date().toISOString();
    const record: BotCredentialRecord = Object.freeze({ botId, tokenPrefix, tokenHash: await sha256(rawToken), createdAt, revokedAt: null });
    if (!writeRecords({ ...records, [botId]: record })) return { ok: false, message: "Picom could not store the bot credential hash safely." };
    return { ok: true, data: Object.freeze({ botId, rawToken, tokenPrefix, createdAt, shownOnce: true }) };
  },

  revokeToken(botId: string, canManage: boolean): CredentialResult<BotCredentialStatus> {
    if (!canManage) return { ok: false, message: "You do not have permission to revoke bot credentials." };
    if (!dataSourceService.getStatus().isMock) return { ok: false, message: "Bot token revocation requires the future trusted Edge Function." };
    const records = readRecords();
    const current = records[botId];
    if (!current) return { ok: false, message: "This bot does not have a local credential." };
    if (current.revokedAt) return { ok: true, data: statusFromRecord(botId, current) };
    const revoked = Object.freeze({ ...current, revokedAt: new Date().toISOString() });
    if (!writeRecords({ ...records, [botId]: revoked })) return { ok: false, message: "Picom could not save the revoked state." };
    return { ok: true, data: statusFromRecord(botId, revoked) };
  },

  async regenerateTokenOnce(botId: string, canManage: boolean): Promise<CredentialResult<IssuedBotToken>> {
    if (!canManage) return { ok: false, message: "You do not have permission to regenerate bot credentials." };
    if (!dataSourceService.getStatus().isMock) return { ok: false, message: "Bot token regeneration requires the trusted rotation function." };
    const records = readRecords();
    const current = records[botId];
    if (!current) return { ok: false, message: "This bot does not have a credential to regenerate." };
    if (!current.revokedAt && !writeRecords({ ...records, [botId]: Object.freeze({ ...current, revokedAt: new Date().toISOString() }) })) return { ok: false, message: "Picom could not revoke the previous bot credential." };
    return this.issueTokenOnce(botId, canManage);
  },
};
