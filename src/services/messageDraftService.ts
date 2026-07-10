const STORAGE_KEY = "picom.messageDrafts.v1";
export type DraftRecord = Readonly<{ text: string; updatedAt: string }>;
type DraftMap = Record<string, DraftRecord>;
export type DraftContext = Readonly<
  | { communityId: string; channelId: string; directConversationId?: never }
  | { directConversationId: string; communityId?: never; channelId?: never }
>;
export type DraftSyncPolicy = Readonly<{ mode: "local_only"; remoteEnabled: false; reason: string }>;

function storage(): Storage | null { if (typeof window === "undefined") return null; try { return window.localStorage; } catch { return null; } }
function key(context: DraftContext): string { return context.directConversationId ? `dm:${context.directConversationId}` : `community:${context.communityId}:channel:${context.channelId}`; }
function legacyKey(context: DraftContext): string | null { return context.directConversationId ? null : `${context.communityId}:${context.channelId}`; }
function read(): DraftMap { const target = storage(); if (!target) return {}; try { const parsed = JSON.parse(target.getItem(STORAGE_KEY) ?? "{}") as DraftMap; return parsed && typeof parsed === "object" ? parsed : {}; } catch { return {}; } }
function write(items: DraftMap): void { const target = storage(); if (!target) return; try { target.setItem(STORAGE_KEY, JSON.stringify(items)); } catch { /* best-effort; sending must not fail */ } }
function getDraft(context: DraftContext): DraftRecord | null { const items = read(); const current = items[key(context)]; if (current) return current; const legacy = legacyKey(context); if (legacy && items[legacy]) { items[key(context)] = items[legacy]; delete items[legacy]; write(items); return items[key(context)]; } return null; }
function setDraft(context: DraftContext, text: string): void { const items = read(); const target = key(context); if (!text.trim()) { delete items[target]; const legacy = legacyKey(context); if (legacy) delete items[legacy]; write(items); return; } items[target] = { text: text.slice(0, 4000), updatedAt: new Date().toISOString() }; write(items); }
function clearDraft(context: DraftContext): void { const items = read(); delete items[key(context)]; const legacy = legacyKey(context); if (legacy) delete items[legacy]; write(items); }

export function resolveDraftConflict(local: DraftRecord | null, remote: DraftRecord | null): DraftRecord | null {
  if (!local) return remote;
  if (!remote) return local;
  const localTime = Date.parse(local.updatedAt); const remoteTime = Date.parse(remote.updatedAt);
  if (!Number.isFinite(remoteTime) || !Number.isFinite(localTime) || localTime >= remoteTime) return local;
  return remote;
}

export const messageDraftService = {
  getDraft,
  setDraft,
  saveDraft: setDraft,
  clearDraft,
  hasDraft(context: DraftContext): boolean { return Boolean(getDraft(context)?.text.trim()); },
  getStorageKey(): string { return STORAGE_KEY; },
  getDraftKey(context: DraftContext): string { return key(context); },
  getSyncPolicy(): DraftSyncPolicy { return { mode: "local_only", remoteEnabled: false, reason: "Cross-device draft sync requires explicit user consent and privacy review." }; },
  prepareRemoteSync(): Readonly<{ ok: false; reason: string }> { return { ok: false, reason: "Remote draft sync is disabled. Text, secrets, tokens, and files remain local." }; },
};
