import { loggingService } from "./loggingService";
import { sleepWakeResumeService, type ResumeEvent } from "./sleepWakeResumeService";
import { voiceDeviceService } from "./voiceDeviceService";
import { voiceService } from "./voiceService";

let started = false;
let cleanupCallbacks: Array<() => void> = [];
let recoverySequence = 0;
let pendingResumeTimer: number | null = null;
let pendingResumeResolve: (() => void) | null = null;

function cancelPendingResumeDelay(): void {
  if (pendingResumeTimer !== null) window.clearTimeout(pendingResumeTimer);
  pendingResumeTimer = null;
  const resolve = pendingResumeResolve;
  pendingResumeResolve = null;
  resolve?.();
}

function waitForResumeRecovery(): Promise<void> {
  cancelPendingResumeDelay();
  return new Promise((resolve) => {
    pendingResumeResolve = resolve;
    pendingResumeTimer = window.setTimeout(() => {
      pendingResumeTimer = null;
      pendingResumeResolve = null;
      resolve();
    }, 1_200);
  });
}

async function recoverAfterResume(event: ResumeEvent): Promise<void> {
  const sequence = ++recoverySequence;
  await voiceDeviceService.refresh(false);

  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  await waitForResumeRecovery();
  if (sequence !== recoverySequence || !voiceService.canReconnect()) return;

  const result = await voiceService.reconnect();
  if (!result.ok && result.error.message !== "Voice reconnect was canceled.") {
    loggingService.logWarn("Voice recovery after desktop resume failed", {
      reason: event.reason,
      errorCode: result.error.code,
    }, "voice-recovery");
  }
}

export const voiceSessionRecoveryService = {
  start(): () => void {
    if (started) return () => undefined;
    started = true;

    const unsubscribeResume = sleepWakeResumeService.onResume((event) => {
      void recoverAfterResume(event);
    });
    const stopResumeMonitoring = sleepWakeResumeService.start();
    cleanupCallbacks = [unsubscribeResume, stopResumeMonitoring];

    return () => voiceSessionRecoveryService.stop();
  },

  stop(): void {
    recoverySequence += 1;
    cancelPendingResumeDelay();
    cleanupCallbacks.forEach((cleanup) => cleanup());
    cleanupCallbacks = [];
    started = false;
  },
};
