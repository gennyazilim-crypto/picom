import { loggingService } from "./loggingService";

export type MultiClientSyncEventType =
  | "user:profile_updated"
  | "user:settings_updated"
  | "user:session_revoked"
  | "user:permissions_updated"
  | "user:membership_updated";

export type MultiClientSyncEvent = Readonly<{
  id: string;
  type: MultiClientSyncEventType;
  userId: string;
  sessionId?: string;
  communityId?: string;
  changedKeys?: string[];
  reason?: string;
  timestamp: string;
  source: "local_placeholder" | "supabase_realtime_placeholder";
}>;

export type MultiClientSyncListener = (event: MultiClientSyncEvent) => void;

const listeners = new Set<MultiClientSyncListener>();
let syncCounter = 0;

export const multiClientSessionSyncEvents: readonly MultiClientSyncEventType[] = [
  "user:profile_updated",
  "user:settings_updated",
  "user:session_revoked",
  "user:permissions_updated",
  "user:membership_updated",
];

function createSyncEventId(): string {
  syncCounter += 1;
  return `multi-client-sync-${Date.now()}-${syncCounter}`;
}

function emit(event: MultiClientSyncEvent): void {
  loggingService.logInfo("Multi-client sync event received", {
    eventId: event.id,
    type: event.type,
    userId: event.userId,
    sessionId: event.sessionId,
    communityId: event.communityId,
    changedKeys: event.changedKeys,
    reason: event.reason,
    source: event.source
  }, "multi-client-sync");

  for (const listener of listeners) {
    listener(event);
  }
}

export const multiClientSessionSyncService = {
  subscribe(listener: MultiClientSyncListener): () => void {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  },

  emitLocalPlaceholder(input: Omit<MultiClientSyncEvent, "id" | "timestamp" | "source">): MultiClientSyncEvent {
    const event: MultiClientSyncEvent = {
      ...input,
      id: createSyncEventId(),
      timestamp: new Date().toISOString(),
      source: "local_placeholder",
    };

    emit(event);
    return event;
  },

  getEventNames(): readonly MultiClientSyncEventType[] {
    return multiClientSessionSyncEvents;
  },

  getSupabaseChannelName(userId: string): string {
    return `user-sync:${userId}`;
  },

  getUserFacingSessionRevokedMessage(): string {
    return "You were signed out because this desktop session was revoked.";
  }
};
