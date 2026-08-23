import type { VoiceConnectionQuality, VoiceConnectionStatus } from "../../services/voiceService";
import type { LiveScreenShareCategory } from "../../types/liveScreenShare";
import { validateGoLiveDescription, validateGoLiveTitle } from "./goLiveModel.ts";

export type CreatorStudioTabId = "chat" | "activity" | "viewers" | "moderation";
export type CreatorStudioChatMode = "everyone" | "subscribers" | "disabled";
export type CreatorStudioHealthLevel = "healthy" | "degraded" | "reconnecting" | "failed";

export type CreatorStudioHealthSnapshot = Readonly<{
  level: CreatorStudioHealthLevel;
  label: string;
  connectionState: VoiceConnectionStatus;
  connectionQuality: VoiceConnectionQuality | "unknown";
  rttMs: number | null;
  packetLossPct: number | null;
  bitrateKbps: number | null;
  fps: number | null;
  width: number | null;
  height: number | null;
  droppedFramesPct: number | null;
  reconnectCount: number;
  screenPublishing: boolean;
  microphonePublishing: boolean;
  cameraPublishing: boolean;
}>;

export type CreatorStudioActivityEvent = Readonly<{
  id: string;
  eventType: string;
  actorUserId: string | null;
  actorDisplayName: string;
  safeMetadata: Readonly<Record<string, unknown>>;
  createdAt: string;
}>;

export type CreatorStudioViewerRow = Readonly<{
  viewerUserId: string;
  displayName: string;
  username: string;
  joinedAt: string;
  lastSeenAt: string;
}>;

export type CreatorStudioSummary = Readonly<{
  sessionId: string;
  title: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  peakConcurrentViewers: number;
  uniqueViewerCount: number;
  chatMessageCount: number;
  reconnectCount: number;
}>;

export type CreatorStudioSession = Readonly<{
  id: string;
  communityId: string;
  channelId: string;
  broadcasterUserId: string;
  livekitRoomName: string;
  title: string;
  description: string;
  category: LiveScreenShareCategory;
  applicationName: string;
  languageCode: string;
  visibilityMode: string;
  chatMode: CreatorStudioChatMode;
  status: string;
  startedAt: string;
  endedAt: string | null;
  viewerCount: number;
  peakConcurrentViewers: number;
  uniqueViewerCount: number;
  reconnectCount: number;
  participantCount: number;
  communityName: string;
  channelName: string;
  isOwner: boolean;
  canModerate: boolean;
}>;

export const CREATOR_STUDIO_TABS: readonly CreatorStudioTabId[] = ["chat", "activity", "viewers", "moderation"];

export function studioTabLabel(tab: CreatorStudioTabId): string {
  switch (tab) {
    case "chat":
      return "Chat";
    case "activity":
      return "Activity";
    case "viewers":
      return "Viewers";
    case "moderation":
      return "Moderation";
    default:
      return "Chat";
  }
}

export function formatStudioDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

export function mapCreatorStudioHealth(input: {
  status: VoiceConnectionStatus;
  connectionQuality: VoiceConnectionQuality | "unknown";
  screenPublishing: boolean;
  microphoneEnabled: boolean;
  cameraEnabled: boolean;
  reconnectCount: number;
  stats?: Readonly<{
    rttMs?: number | null;
    packetLossPct?: number | null;
    bitrateKbps?: number | null;
    fps?: number | null;
    width?: number | null;
    height?: number | null;
    droppedFramesPct?: number | null;
  }>;
}): CreatorStudioHealthSnapshot {
  const stats = input.stats ?? {};
  let level: CreatorStudioHealthLevel = "healthy";
  let label = "Excellent";

  if (input.status === "disconnected" || input.status === "error") {
    level = "failed";
    label = "Failed";
  } else if (input.status === "reconnecting" || input.status === "connecting") {
    level = "reconnecting";
    label = "Reconnecting";
  } else if (!input.screenPublishing) {
    level = "degraded";
    label = "Screen not publishing";
  } else if (input.connectionQuality === "poor" || (typeof stats.packetLossPct === "number" && stats.packetLossPct >= 8)) {
    level = "degraded";
    label = "Degraded";
  } else if (input.connectionQuality === "lost") {
    level = "failed";
    label = "Connection lost";
  }

  return {
    level,
    label,
    connectionState: input.status,
    connectionQuality: input.connectionQuality,
    rttMs: typeof stats.rttMs === "number" && Number.isFinite(stats.rttMs) ? stats.rttMs : null,
    packetLossPct: typeof stats.packetLossPct === "number" && Number.isFinite(stats.packetLossPct) ? stats.packetLossPct : null,
    bitrateKbps: typeof stats.bitrateKbps === "number" && Number.isFinite(stats.bitrateKbps) ? stats.bitrateKbps : null,
    fps: typeof stats.fps === "number" && Number.isFinite(stats.fps) ? stats.fps : null,
    width: typeof stats.width === "number" && stats.width > 0 ? stats.width : null,
    height: typeof stats.height === "number" && stats.height > 0 ? stats.height : null,
    droppedFramesPct: typeof stats.droppedFramesPct === "number" && Number.isFinite(stats.droppedFramesPct) ? stats.droppedFramesPct : null,
    reconnectCount: Math.max(0, input.reconnectCount),
    screenPublishing: input.screenPublishing,
    microphonePublishing: input.microphoneEnabled,
    cameraPublishing: input.cameraEnabled,
  };
}

export function formatMeasurable(value: number | null, suffix = ""): string {
  if (value == null || !Number.isFinite(value)) return "Not measurable";
  if (suffix === "%") return `${value.toFixed(1)}%`;
  if (suffix === "kbps") return `${Math.round(value)} kbps`;
  if (suffix === "ms") return `${Math.round(value)} ms`;
  if (suffix === "fps") return `${Math.round(value)} fps`;
  return String(Math.round(value));
}

export function validateStudioMetadata(input: {
  title?: string;
  description?: string;
  category?: string;
  chatMode?: string;
}): Readonly<{ ok: true }> | Readonly<{ ok: false; message: string }> {
  if (input.title !== undefined) {
    const title = validateGoLiveTitle(input.title);
    if (!title.ok) return title;
  }
  if (input.description !== undefined) {
    const description = validateGoLiveDescription(input.description);
    if (!description.ok) return description;
  }
  if (input.category !== undefined) {
    if (!["game", "chat", "education", "watch_together", "other"].includes(input.category)) {
      return { ok: false, message: "Invalid category." };
    }
  }
  if (input.chatMode !== undefined) {
    if (!["everyone", "subscribers", "disabled"].includes(input.chatMode)) {
      return { ok: false, message: "Invalid chat mode." };
    }
  }
  return { ok: true };
}

export function activityEventLabel(eventType: string): string {
  switch (eventType) {
    case "viewer_joined":
      return "Viewer joined";
    case "viewer_left":
      return "Viewer left";
    case "follow":
      return "New follow";
    case "moderation_action":
      return "Moderation action";
    case "stream_reconnect":
      return "Stream reconnected";
    case "metadata_update":
      return "Metadata updated";
    case "health_degraded":
      return "Health degraded";
    case "source_changed":
      return "Source changed";
    case "stream_ended":
      return "Stream ended";
    default:
      return eventType;
  }
}
