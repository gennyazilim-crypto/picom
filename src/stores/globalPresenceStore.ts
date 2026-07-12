import type { GlobalPresenceSnapshot, PresenceConnectionState, PresencePreference } from "../types/presence";

const listeners = new Set<() => void>();
let preference: PresencePreference = "online";
let connection: PresenceConnectionState = "disconnected";
let error: string | null = null;

export function deriveGlobalPresenceSnapshot(
  nextPreference: PresencePreference,
  nextConnection: PresenceConnectionState,
  nextError: string | null = null,
): GlobalPresenceSnapshot {
  if (nextConnection !== "connected") {
    return { preference: nextPreference, connection: nextConnection, publicStatus: "offline", dotStatus: "offline", label: "Offline", visibleToOthers: false, error: nextError };
  }
  if (nextPreference === "invisible") {
    return { preference: nextPreference, connection: nextConnection, publicStatus: "offline", dotStatus: "offline", label: "Invisible", visibleToOthers: false, error: nextError };
  }
  if (nextPreference === "dnd") {
    return { preference: nextPreference, connection: nextConnection, publicStatus: "dnd", dotStatus: "dnd", label: "Do Not Disturb", visibleToOthers: true, error: nextError };
  }
  if (nextPreference === "idle") {
    return { preference: nextPreference, connection: nextConnection, publicStatus: "idle", dotStatus: "idle", label: "Idle", visibleToOthers: true, error: nextError };
  }
  return { preference: nextPreference, connection: nextConnection, publicStatus: "online", dotStatus: "online", label: "Online", visibleToOthers: true, error: nextError };
}

let snapshot = deriveGlobalPresenceSnapshot(preference, connection, error);

function emit(): void {
  snapshot = deriveGlobalPresenceSnapshot(preference, connection, error);
  for (const listener of listeners) listener();
}

export const globalPresenceStore = {
  getSnapshot(): GlobalPresenceSnapshot {
    return snapshot;
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  setPreference(nextPreference: PresencePreference): void {
    if (preference === nextPreference) return;
    preference = nextPreference;
    emit();
  },
  setConnection(nextConnection: PresenceConnectionState, nextError: string | null = null): void {
    if (connection === nextConnection && error === nextError) return;
    connection = nextConnection;
    error = nextError;
    emit();
  },
};
