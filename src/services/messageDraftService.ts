const STORAGE_KEY = "picom.messageDrafts.v1";

type DraftRecord = {
  text: string;
  updatedAt: string;
};

type DraftMap = Record<string, DraftRecord>;

type DraftContext = {
  communityId: string;
  channelId: string;
};

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function getDraftKey(context: DraftContext): string {
  return `${context.communityId}:${context.channelId}`;
}

function readDrafts(): DraftMap {
  const storage = getStorage();
  if (!storage) return {};

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as DraftMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeDrafts(drafts: DraftMap): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  } catch {
    // Draft persistence is best-effort. It must never block message sending.
  }
}

export const messageDraftService = {
  getDraft(context: DraftContext): DraftRecord | null {
    return readDrafts()[getDraftKey(context)] ?? null;
  },

  saveDraft(context: DraftContext, text: string): void {
    const drafts = readDrafts();
    const key = getDraftKey(context);
    const value = text.trimEnd();

    if (!value.trim()) {
      delete drafts[key];
      writeDrafts(drafts);
      return;
    }

    drafts[key] = {
      text,
      updatedAt: new Date().toISOString(),
    };
    writeDrafts(drafts);
  },

  clearDraft(context: DraftContext): void {
    const drafts = readDrafts();
    delete drafts[getDraftKey(context)];
    writeDrafts(drafts);
  },

  getStorageKey(): string {
    return STORAGE_KEY;
  },
};
