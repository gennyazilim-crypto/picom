import { loggingService } from "./loggingService";
import { sleepWakeResumeService, type ResumeEvent } from "./sleepWakeResumeService";
import { voiceDeviceService } from "./voiceDeviceService";
import { voiceService } from "./voiceService";

let started = false;
let cleanupCallbacks: Array<() => void> = [];
let recoverySequence = 0;

async function recoverAfterResume(event: ResumeEvent): Promise<void> {
  const sequence = ++recoverySequence;
  await voiceDeviceService.refresh(false);

  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  await new Promise<void>((resolve) => window.setTimeout(resolve, 1_200));
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
    cleanupCallbacks.forEach((cleanup) => cleanup());
    cleanupCallbacks = [];
    started = false;
  },
};
