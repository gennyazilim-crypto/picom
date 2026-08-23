import type { LiveScreenShareStatus, LiveScreenShareSummary } from "../../types/liveScreenShare";
import type { VoiceConnectionStatus, VoiceScreenShare } from "../../services/voiceService";

export const LIVE_WATCH_VOLUME_KEY = "picom.live.watch.player-volume.v1";
export const LIVE_WATCH_CHAT_OPEN_KEY = "picom.live.watch.chat-open.v1";
export const LIVE_DISCOVERY_RESTORE_KEY = "picom.live.discovery.restore.v1";

export type LiveWatchPlayerPhase =
  | "loading"
  | "connecting"
  | "live"
  | "reconnecting"
  | "ended"
  | "permission_denied"
  | "unavailable"
  | "track_unavailable"
  | "error";

export type LiveWatchReportReasonId =
  | "inappropriate"
  | "harassment"
  | "hate"
  | "scam"
  | "harmful"
  | "copyright"
  | "other";

export type LiveWatchReportReason = Readonly<{
  id: LiveWatchReportReasonId;
  label: string;
  payload: string;
}>;

/** Canonical Watch report taxonomy → live_share_reports.reason text. */
export const LIVE_WATCH_REPORT_REASONS: readonly LiveWatchReportReason[] = [
  { id: "inappropriate", label: "Inappropriate content", payload: "Inappropriate content" },
  { id: "harassment", label: "Harassment", payload: "Harassment" },
  { id: "hate", label: "Hate speech", payload: "Hate speech" },
  { id: "scam", label: "Scams or fraud", payload: "Scams or fraud" },
  { id: "harmful", label: "Harmful or dangerous content", payload: "Harmful or dangerous content" },
  { id: "copyright", label: "Copyright", payload: "Copyright" },
  { id: "other", label: "Other", payload: "Other" },
] as const;

export type LiveDiscoveryRestoreState = Readonly<{
  query: string;
  filter: string;
  categoryFilter: string | null;
  featuredOverrideId: string | null;
  scrollTop: number;
}>;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseLiveSessionIdParam(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || !UUID_RE.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

export function isWatchableLiveStatus(status: LiveScreenShareStatus): boolean {
  return status === "live" || status === "reconnecting";
}

export function isEndedLiveStatus(status: LiveScreenShareStatus): boolean {
  return status === "ended" || status === "terminated";
}

export function formatWatchDuration(startedAt: string, now: number = Date.now()): string {
  const started = Date.parse(startedAt);
  if (!Number.isFinite(started)) return "—";
  const totalSeconds = Math.max(0, Math.floor((now - started) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatWatchViewerCount(count: number | null | undefined): string | null {
  if (count == null || !Number.isFinite(count) || count < 0) return null;
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(Math.trunc(count));
}

export function loadWatchVolume(fallback = 0.85): number {
  try {
    const raw = globalThis.localStorage?.getItem(LIVE_WATCH_VOLUME_KEY);
    if (raw == null) return fallback;
    const value = Number(raw);
    if (!Number.isFinite(value)) return fallback;
    return Math.min(1, Math.max(0, value));
  } catch {
    return fallback;
  }
}

export function persistWatchVolume(volume: number): void {
  try {
    globalThis.localStorage?.setItem(LIVE_WATCH_VOLUME_KEY, String(Math.min(1, Math.max(0, volume))));
  } catch {
    /* private mode */
  }
}

export function loadChatOpenPreference(fallback = true): boolean {
  try {
    const raw = globalThis.localStorage?.getItem(LIVE_WATCH_CHAT_OPEN_KEY);
    if (raw == null) return fallback;
    return raw === "1" || raw === "true";
  } catch {
    return fallback;
  }
}

export function persistChatOpenPreference(open: boolean): void {
  try {
    globalThis.localStorage?.setItem(LIVE_WATCH_CHAT_OPEN_KEY, open ? "1" : "0");
  } catch {
    /* private mode */
  }
}

export function saveDiscoveryRestoreState(state: LiveDiscoveryRestoreState): void {
  try {
    globalThis.sessionStorage?.setItem(LIVE_DISCOVERY_RESTORE_KEY, JSON.stringify(state));
  } catch {
    /* private mode */
  }
}

export function consumeDiscoveryRestoreState(): LiveDiscoveryRestoreState | null {
  try {
    const raw = globalThis.sessionStorage?.getItem(LIVE_DISCOVERY_RESTORE_KEY);
    if (!raw) return null;
    globalThis.sessionStorage?.removeItem(LIVE_DISCOVERY_RESTORE_KEY);
    const parsed = JSON.parse(raw) as LiveDiscoveryRestoreState;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      query: typeof parsed.query === "string" ? parsed.query : "",
      filter: typeof parsed.filter === "string" ? parsed.filter : "all",
      categoryFilter: typeof parsed.categoryFilter === "string" ? parsed.categoryFilter : null,
      featuredOverrideId: typeof parsed.featuredOverrideId === "string" ? parsed.featuredOverrideId : null,
      scrollTop: Number.isFinite(parsed.scrollTop) ? Math.max(0, Number(parsed.scrollTop)) : 0,
    };
  } catch {
    return null;
  }
}

export function selectBroadcasterScreenShare(
  shares: readonly VoiceScreenShare[],
  broadcasterUserId: string,
): VoiceScreenShare | null {
  if (!shares.length || !broadcasterUserId) return null;
  return shares.find(
    (share) => !share.isLocal && share.participantIdentity === broadcasterUserId,
  ) ?? null;
}

export function resolveWatchPlayerPhase(input: {
  loadErrorCode: string | null;
  session: LiveScreenShareSummary | null;
  voiceStatus: VoiceConnectionStatus;
  hasTrack: boolean;
  sessionEndedLocally: boolean;
}): LiveWatchPlayerPhase {
  const { loadErrorCode, session, voiceStatus, hasTrack, sessionEndedLocally } = input;

  if (loadErrorCode === "AUTH_REQUIRED" || loadErrorCode === "LIVE_FORBIDDEN") {
    return "permission_denied";
  }
  if (loadErrorCode === "LIVE_NOT_FOUND") return "unavailable";
  if (loadErrorCode) return "error";
  if (!session) return "loading";

  if (sessionEndedLocally || isEndedLiveStatus(session.status)) return "ended";
  if (session.status === "reconnecting") return "reconnecting";

  if (voiceStatus === "connecting" || voiceStatus === "idle") return "connecting";
  if (voiceStatus === "reconnecting") return "reconnecting";
  if (voiceStatus === "error" || voiceStatus === "disconnected") return "error";
  if (voiceStatus === "connected" && !hasTrack) return "track_unavailable";
  if (voiceStatus === "connected" && hasTrack) return "live";
  return "connecting";
}

export function mapWatchLoadErrorMessage(code: string | null, fallback: string): string {
  switch (code) {
    case "AUTH_REQUIRED":
      return "Sign in to watch this live stream.";
    case "LIVE_FORBIDDEN":
      return "You do not have permission to watch this stream.";
    case "LIVE_NOT_FOUND":
      return "This live stream is unavailable.";
    case "DATA_SOURCE_NOT_CONFIGURED":
      return "Live streaming is not configured in this environment.";
    default:
      return fallback || "Could not open this live stream.";
  }
}

export function categoryLabel(category: LiveScreenShareSummary["category"]): string {
  switch (category) {
    case "game":
      return "Game";
    case "chat":
      return "Just chatting";
    case "education":
      return "Education";
    case "watch_together":
      return "Watch together";
    default:
      return "Other";
  }
}
