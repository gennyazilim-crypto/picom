const STORAGE_KEY = "picom.messageModerationFilters.v1";
const SCHEMA_VERSION = 1;

export type ModerationFilterSettings = Readonly<{
  communityId: string;
  blockedWords: string[];
  maxMentionsPerMessage: number;
  updatedAt: string | null;
}>;

type StoredModerationFilters = Record<string, ModerationFilterSettings>;

export type ModerationCheckResult = Readonly<{
  allowed: boolean;
  reason?: string;
  matchedWord?: string;
}>;

function readStore(): StoredModerationFilters {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as { schemaVersion?: number; records?: StoredModerationFilters };
    if (parsed.schemaVersion !== SCHEMA_VERSION || !parsed.records) return {};
    return parsed.records;
  } catch {
    return {};
  }
}

function writeStore(records: StoredModerationFilters): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, records }));
  } catch {
    // Local storage can be unavailable in restricted desktop fallback contexts.
  }
}

function normalizeBlockedWords(value: string[] | string): string[] {
  const list = Array.isArray(value) ? value : value.split(/[\n,]/g);
  return Array.from(new Set(list.map((word) => word.trim().toLowerCase()).filter(Boolean))).slice(0, 80);
}

function getDefaultSettings(communityId: string): ModerationFilterSettings {
  return {
    communityId,
    blockedWords: [],
    maxMentionsPerMessage: 8,
    updatedAt: null,
  };
}

export const messageModerationFilterService = {
  getSettings(communityId: string): ModerationFilterSettings {
    return readStore()[communityId] ?? getDefaultSettings(communityId);
  },

  saveSettings(communityId: string, blockedWords: string[] | string, maxMentionsPerMessage = 8): ModerationFilterSettings {
    const next: ModerationFilterSettings = {
      communityId,
      blockedWords: normalizeBlockedWords(blockedWords),
      maxMentionsPerMessage: Math.max(1, Math.min(50, Math.floor(maxMentionsPerMessage || 8))),
      updatedAt: new Date().toISOString(),
    };

    writeStore({
      ...readStore(),
      [communityId]: next,
    });

    return next;
  },

  checkMessage(communityId: string, body: string): ModerationCheckResult {
    const settings = this.getSettings(communityId);
    const normalizedBody = body.toLowerCase();
    const matchedWord = settings.blockedWords.find((word) => normalizedBody.includes(word));

    if (matchedWord) {
      return {
        allowed: false,
        matchedWord,
        reason: "This message was blocked by the community moderation filter placeholder.",
      };
    }

    const mentionCount = (body.match(/@\w+/g) ?? []).length;
    if (mentionCount > settings.maxMentionsPerMessage) {
      return {
        allowed: false,
        reason: "This message has too many mentions for the moderation filter placeholder.",
      };
    }

    return { allowed: true };
  },
};