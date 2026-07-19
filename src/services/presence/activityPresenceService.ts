export type ActivityKind = "none" | "game" | "music";

export type ActivitySnapshot = Readonly<{
  kind: ActivityKind;
  statusText: string | null;
  source: string | null;
  title: string | null;
  detail: string | null;
  supported: boolean;
}>;

type ActivityListener = (snapshot: ActivitySnapshot) => void;
type EnabledListener = (enabled: boolean) => void;

const ENABLED_KEY = "picom.activity.auto.enabled.v1";
const POLL_MS = 2_500;
const EMPTY: ActivitySnapshot = Object.freeze({
  kind: "none",
  statusText: null,
  source: null,
  title: null,
  detail: null,
  supported: false,
});

const snapshotListeners = new Set<ActivityListener>();
const enabledListeners = new Set<EnabledListener>();

let enabled = readEnabled();
let snapshot: ActivitySnapshot = EMPTY;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let inFlight = false;

function readEnabled(): boolean {
  try {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(ENABLED_KEY) === "1";
  } catch {
    return false;
  }
}

function publishEnabled(next: boolean): void {
  enabled = next;
  for (const listener of enabledListeners) listener(next);
}

function publishSnapshot(next: ActivitySnapshot): void {
  const changed =
    next.kind !== snapshot.kind ||
    next.statusText !== snapshot.statusText ||
    next.source !== snapshot.source ||
    next.title !== snapshot.title ||
    next.detail !== snapshot.detail ||
    next.supported !== snapshot.supported;
  snapshot = next;
  if (!changed) return;
  for (const listener of snapshotListeners) listener(next);
}

function getBridge() {
  if (typeof window === "undefined") return null;
  return window.picomDesktop?.activity ?? null;
}

export function isActivityBridgeAvailable(): boolean {
  return getBridge() !== null;
}

async function refreshSnapshot(): Promise<void> {
  if (!enabled || inFlight) return;
  const bridge = getBridge();
  if (!bridge) {
    publishSnapshot(EMPTY);
    return;
  }

  inFlight = true;
  try {
    const result = await bridge.getSnapshot();
    if (!result.ok) {
      publishSnapshot({ ...EMPTY, supported: snapshot.supported });
      return;
    }
    publishSnapshot(result.snapshot);
  } catch {
    publishSnapshot({ ...EMPTY, supported: snapshot.supported });
  } finally {
    inFlight = false;
  }
}

function ensurePolling(): void {
  if (!enabled || !getBridge()) {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    return;
  }
  if (pollTimer) return;
  void refreshSnapshot();
  pollTimer = setInterval(() => {
    void refreshSnapshot();
  }, POLL_MS);
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== ENABLED_KEY) return;
    publishEnabled(event.newValue === "1");
    ensurePolling();
  });
  ensurePolling();
}

export const activityPresenceService = {
  isAvailable(): boolean {
    return isActivityBridgeAvailable();
  },
  getEnabled(): boolean {
    return enabled;
  },
  setEnabled(next: boolean): boolean {
    const normalized = Boolean(next);
    try {
      window.localStorage.setItem(ENABLED_KEY, normalized ? "1" : "0");
    } catch {
      /* restricted storage fallback */
    }
    publishEnabled(normalized);
    if (!normalized) publishSnapshot(EMPTY);
    ensurePolling();
    if (normalized) void refreshSnapshot();
    return normalized;
  },
  getSnapshot(): ActivitySnapshot {
    return snapshot;
  },
  getLiveStatusText(): string | null {
    if (!enabled) return null;
    const text = snapshot.statusText?.trim();
    return text || null;
  },
  subscribe(listener: ActivityListener): () => void {
    snapshotListeners.add(listener);
    listener(snapshot);
    ensurePolling();
    return () => snapshotListeners.delete(listener);
  },
  subscribeEnabled(listener: EnabledListener): () => void {
    enabledListeners.add(listener);
    listener(enabled);
    return () => enabledListeners.delete(listener);
  },
  refresh(): Promise<void> {
    return refreshSnapshot();
  },
};
