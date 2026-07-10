const STORAGE_KEY = "picom.messageModerationFilters.v2";
const ACTIVITY_KEY = "picom.messageModerationActivity.v1";
const SENT_KEY = "picom.messageModerationLastSent.v1";
const SCHEMA_VERSION = 2;

export type ModerationFilterSettings = Readonly<{ communityId: string; blockedWords: string[]; maxMentionsPerMessage: number; linkBlockingEnabled: boolean; slowModeSeconds: number; updatedAt: string | null }>;
export type ModerationBlockedItem = Readonly<{ id: string; communityId: string; rule: "blocked_word" | "mention_limit" | "link_block" | "slow_mode"; reason: string; matchedWord?: string; createdAt: string }>;
type StoredModerationFilters = Record<string, ModerationFilterSettings>;
export type ModerationCheckResult = Readonly<{ allowed: boolean; reason?: string; matchedWord?: string; retryAfterSeconds?: number }>;

function readJson<T>(key: string, fallback: T): T { try { const raw = window.localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; } }
function writeJson(key: string, value: unknown): void { try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* restricted fallback */ } }
function readStore(): StoredModerationFilters { const parsed = readJson<{ schemaVersion?: number; records?: StoredModerationFilters }>(STORAGE_KEY, {}); return parsed.schemaVersion === SCHEMA_VERSION && parsed.records ? parsed.records : {}; }
function normalizeBlockedWords(value: string[] | string): string[] { const list = Array.isArray(value) ? value : value.split(/[\n,]/g); return Array.from(new Set(list.map((word) => word.trim().toLowerCase()).filter(Boolean))).slice(0, 80); }
function defaults(communityId: string): ModerationFilterSettings { return { communityId, blockedWords: [], maxMentionsPerMessage: 8, linkBlockingEnabled: false, slowModeSeconds: 0, updatedAt: null }; }
function recordBlocked(item: Omit<ModerationBlockedItem, "id" | "createdAt">): void { const current = readJson<ModerationBlockedItem[]>(ACTIVITY_KEY, []); writeJson(ACTIVITY_KEY, [{ ...item, id: crypto.randomUUID(), createdAt: new Date().toISOString() }, ...current].slice(0, 100)); }
function sendKey(communityId: string, channelId: string, userId: string): string { return `${communityId}:${channelId}:${userId}`; }

export const messageModerationFilterService = {
  getSettings(communityId: string): ModerationFilterSettings { return readStore()[communityId] ?? defaults(communityId); },
  saveSettings(communityId: string, blockedWords: string[] | string, maxMentionsPerMessage = 8, linkBlockingEnabled = false, slowModeSeconds = 0): ModerationFilterSettings {
    const next: ModerationFilterSettings = { communityId, blockedWords: normalizeBlockedWords(blockedWords), maxMentionsPerMessage: Math.max(1, Math.min(50, Math.floor(maxMentionsPerMessage || 8))), linkBlockingEnabled, slowModeSeconds: Math.max(0, Math.min(21600, Math.floor(slowModeSeconds || 0))), updatedAt: new Date().toISOString() };
    writeJson(STORAGE_KEY, { schemaVersion: SCHEMA_VERSION, records: { ...readStore(), [communityId]: next } }); return next;
  },
  checkMessage(communityId: string, body: string, userId = "current-user", channelId = "global"): ModerationCheckResult {
    const settings = this.getSettings(communityId); const normalizedBody = body.toLowerCase(); const matchedWord = settings.blockedWords.find((word) => normalizedBody.includes(word));
    if (matchedWord) { const result = { allowed: false, matchedWord, reason: "This message contains a word blocked by community moderation." } as const; recordBlocked({ communityId, rule: "blocked_word", reason: result.reason, matchedWord }); return result; }
    const mentionCount = (body.match(/@[a-zA-Z0-9_]+/g) ?? []).length;
    if (mentionCount > settings.maxMentionsPerMessage) { const result = { allowed: false, reason: `This community allows at most ${settings.maxMentionsPerMessage} mentions per message.` } as const; recordBlocked({ communityId, rule: "mention_limit", reason: result.reason }); return result; }
    if (settings.linkBlockingEnabled && /https?:\/\/|www\./i.test(body)) { const result = { allowed: false, reason: "Links are currently blocked by this community." } as const; recordBlocked({ communityId, rule: "link_block", reason: result.reason }); return result; }
    if (settings.slowModeSeconds > 0) { const sent = readJson<Record<string, number>>(SENT_KEY, {}); const elapsed = Math.floor((Date.now() - (sent[sendKey(communityId, channelId, userId)] ?? 0)) / 1000); if (elapsed < settings.slowModeSeconds) { const retryAfterSeconds = settings.slowModeSeconds - elapsed; const result = { allowed: false, retryAfterSeconds, reason: `Slow mode is active. Try again in ${retryAfterSeconds}s.` } as const; recordBlocked({ communityId, rule: "slow_mode", reason: result.reason }); return result; } }
    return { allowed: true };
  },
  recordMessageSent(communityId: string, channelId: string, userId: string): void { const sent = readJson<Record<string, number>>(SENT_KEY, {}); writeJson(SENT_KEY, { ...sent, [sendKey(communityId, channelId, userId)]: Date.now() }); },
  getRecentBlockedItems(communityId: string, limit = 20): ModerationBlockedItem[] { return readJson<ModerationBlockedItem[]>(ACTIVITY_KEY, []).filter((item) => item.communityId === communityId).slice(0, limit); },
};
