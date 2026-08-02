import { liveScreenShareService, type UpsertLiveShareInput } from "./liveScreenShareService";
import { loggingService } from "../loggingService";

/**
 * Thin bridge so `voiceService` can register/refresh/end the local broadcaster's
 * Picom Live listing without importing `liveScreenShareService` directly (keeps the
 * dependency direction one-way: voiceService -> registry -> service).
 */

const HEARTBEAT_INTERVAL_MS = 20_000;

let currentSessionId: string | null = null;
let currentParticipantCount = 0;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

function clearHeartbeatTimer(): void {
  if (heartbeatTimer === null) return;
  clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

function sendHeartbeat(sessionId: string): void {
  void liveScreenShareService.heartbeatLiveShare(sessionId, { participantCount: currentParticipantCount }).then((result) => {
    if (!result.ok) {
      loggingService.logWarn("Picom Live heartbeat failed", { code: result.error.code }, "live");
    }
  });
}

function startHeartbeatTimer(sessionId: string): void {
  clearHeartbeatTimer();
  heartbeatTimer = setInterval(() => {
    if (currentSessionId !== sessionId) {
      clearHeartbeatTimer();
      return;
    }
    sendHeartbeat(sessionId);
  }, HEARTBEAT_INTERVAL_MS);
}

/** Registers (or refreshes) the local broadcast as a visible Picom Live session. */
export async function notifyLocalScreenShareStarted(input: UpsertLiveShareInput): Promise<string | null> {
  const result = await liveScreenShareService.upsertLiveShare(input);
  if (!result.ok) {
    loggingService.logWarn("Picom Live registration failed", { code: result.error.code }, "live");
    return null;
  }

  currentSessionId = result.data.id;
  currentParticipantCount = input.participantCount ?? result.data.participantCount;
  startHeartbeatTimer(currentSessionId);
  return currentSessionId;
}

/** Attach heartbeat ownership for a session already created by Go Live confirm. */
export function attachLiveScreenShareSession(sessionId: string, participantCount = 0): void {
  if (!sessionId) return;
  currentSessionId = sessionId;
  currentParticipantCount = Math.max(0, Math.trunc(participantCount));
  startHeartbeatTimer(sessionId);
  sendHeartbeat(sessionId);
}

/** Updates the tracked participant count and immediately pings the server heartbeat RPC. */
export function notifyLocalScreenShareHeartbeat(sessionId: string, participantCount: number): void {
  if (!sessionId || currentSessionId !== sessionId) return;
  currentParticipantCount = Math.max(0, Math.trunc(participantCount));
  sendHeartbeat(sessionId);
}

/** Ends the live session (defaults to the currently tracked session) and stops the heartbeat timer. */
export function notifyLocalScreenShareStopped(sessionId: string | null): void {
  const targetSessionId = sessionId ?? currentSessionId;
  clearHeartbeatTimer();

  if (targetSessionId === currentSessionId) {
    currentSessionId = null;
    currentParticipantCount = 0;
  }

  if (!targetSessionId) return;

  void liveScreenShareService.endLiveShare(targetSessionId, "ended").then((result) => {
    if (!result.ok) {
      loggingService.logWarn("Picom Live end-session failed", { code: result.error.code }, "live");
    }
  });
}

/** Exposed for diagnostics/tests; not required by the voiceService integration. */
export function getActiveLiveScreenShareSessionId(): string | null {
  return currentSessionId;
}
