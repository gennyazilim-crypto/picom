import { loggingService } from "./loggingService";
import { networkStatusService, type NetworkStatusSnapshot } from "./networkStatusService";

export type ResumeReason = "native_resume" | "visibility_visible" | "window_focus" | "browser_online" | "manual";

export type ResumeEvent = Readonly<{
  reason: ResumeReason;
  timestamp: string;
  network: NetworkStatusSnapshot;
}>;

type ResumeListener = (event: ResumeEvent) => void;

const listeners = new Set<ResumeListener>();
const debounceMs = 2500;
let started = false;
let cleanupCallbacks: Array<() => void> = [];
let lastResumeAt = 0;
let pendingReason: ResumeReason | null = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;

async function emitResume(reason: ResumeReason): Promise<ResumeEvent> {
  const network = await networkStatusService.checkBackendHealth();
  const event: ResumeEvent = {
    reason,
    timestamp: new Date().toISOString(),
    network
  };

  loggingService.logInfo("Desktop resume handling completed", event, "sleep-wake");

  for (const listener of listeners) {
    listener(event);
  }

  return event;
}

function scheduleResume(reason: ResumeReason): void {
  const now = Date.now();
  const elapsed = now - lastResumeAt;
  pendingReason = reason;

  if (elapsed >= debounceMs) {
    lastResumeAt = now;
    const nextReason = pendingReason;
    pendingReason = null;
    void emitResume(nextReason);
    return;
  }

  if (pendingTimer) {
    window.clearTimeout(pendingTimer);
  }

  pendingTimer = window.setTimeout(() => {
    lastResumeAt = Date.now();
    const nextReason = pendingReason ?? reason;
    pendingReason = null;
    pendingTimer = null;
    void emitResume(nextReason);
  }, debounceMs - elapsed);
}

export const sleepWakeResumeService = {
  start(): () => void {
    if (started) {
      return () => undefined;
    }

    started = true;
    networkStatusService.start();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        scheduleResume("visibility_visible");
      }
    };
    const onFocus = () => scheduleResume("window_focus");
    const onOnline = () => scheduleResume("browser_online");

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);

    cleanupCallbacks = [
      () => document.removeEventListener("visibilitychange", onVisibilityChange),
      () => window.removeEventListener("focus", onFocus),
      () => window.removeEventListener("online", onOnline)
    ];

    const nativeCleanup = window.picomDesktop?.power?.onResume(() => {
      scheduleResume("native_resume");
    });
    if (nativeCleanup) {
      cleanupCallbacks.push(nativeCleanup);
    }

    return () => sleepWakeResumeService.stop();
  },

  stop(): void {
    for (const cleanup of cleanupCallbacks) {
      cleanup();
    }

    cleanupCallbacks = [];
    started = false;

    if (pendingTimer) {
      window.clearTimeout(pendingTimer);
      pendingTimer = null;
    }
  },

  onResume(listener: ResumeListener): () => void {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  },

  triggerManualResume(): void {
    scheduleResume("manual");
  }
};
