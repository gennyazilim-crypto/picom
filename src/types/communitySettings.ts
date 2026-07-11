import type { CommunityKind } from "./community";

export type CommunityNotificationLevel = "all" | "mentions" | "none";

export type TextCommunitySettings = Readonly<{
  kind: "text";
  voiceRoomsEnabled: boolean;
  maxMessageLength: number;
  attachmentsEnabled: boolean;
  reactionsEnabled: boolean;
}>;

export type RadioCommunityTypeSettings = Readonly<{
  kind: "radio";
  voiceRoomsEnabled: boolean;
  defaultHostRole: "owner" | "host";
  scheduleTimezone: string;
  scheduleVisibility: "public" | "members";
  listenerChatEnabled: boolean;
  listenerRules: string;
}>;

export type PodcastCommunityTypeSettings = Readonly<{
  kind: "podcast";
  voiceRoomsEnabled: boolean;
  defaultPublisherRole: "owner" | "publisher";
  commentsEnabled: boolean;
  explicitContentDefault: boolean;
  commentRules: string;
}>;

export type CommunityTypeSettings = TextCommunitySettings | RadioCommunityTypeSettings | PodcastCommunityTypeSettings;

export function getDefaultCommunityTypeSettings(kind: CommunityKind): CommunityTypeSettings {
  if (kind === "radio") return { kind, voiceRoomsEnabled: false, defaultHostRole: "host", scheduleTimezone: "UTC", scheduleVisibility: "public", listenerChatEnabled: true, listenerRules: "Keep live discussion relevant and respectful." };
  if (kind === "podcast") return { kind, voiceRoomsEnabled: false, defaultPublisherRole: "publisher", commentsEnabled: true, explicitContentDefault: false, commentRules: "Discuss the episode without harassment or spoilers outside marked threads." };
  return { kind: "text", voiceRoomsEnabled: true, maxMessageLength: 4000, attachmentsEnabled: true, reactionsEnabled: true };
}

export function normalizeCommunityTypeSettings(kind: CommunityKind, value: unknown): CommunityTypeSettings {
  const fallback = getDefaultCommunityTypeSettings(kind);
  if (!value || typeof value !== "object") return fallback;
  const candidate = value as Record<string, unknown>;
  if (candidate.kind !== kind) return fallback;
  if (kind === "text") {
    const typedFallback = fallback as TextCommunitySettings;
    return {
    kind,
    voiceRoomsEnabled: typeof candidate.voiceRoomsEnabled === "boolean" ? candidate.voiceRoomsEnabled : typedFallback.voiceRoomsEnabled,
    maxMessageLength: typeof candidate.maxMessageLength === "number" && candidate.maxMessageLength >= 250 && candidate.maxMessageLength <= 4000 ? Math.floor(candidate.maxMessageLength) : typedFallback.maxMessageLength,
    attachmentsEnabled: typeof candidate.attachmentsEnabled === "boolean" ? candidate.attachmentsEnabled : typedFallback.attachmentsEnabled,
    reactionsEnabled: typeof candidate.reactionsEnabled === "boolean" ? candidate.reactionsEnabled : typedFallback.reactionsEnabled,
    };
  }
  if (kind === "radio") {
    const typedFallback = fallback as RadioCommunityTypeSettings;
    return {
    kind,
    voiceRoomsEnabled: typeof candidate.voiceRoomsEnabled === "boolean" ? candidate.voiceRoomsEnabled : typedFallback.voiceRoomsEnabled,
    defaultHostRole: candidate.defaultHostRole === "owner" ? "owner" : "host",
    scheduleTimezone: typeof candidate.scheduleTimezone === "string" && candidate.scheduleTimezone.trim().length <= 64 ? candidate.scheduleTimezone.trim() || "UTC" : typedFallback.scheduleTimezone,
    scheduleVisibility: candidate.scheduleVisibility === "members" ? "members" : "public",
    listenerChatEnabled: typeof candidate.listenerChatEnabled === "boolean" ? candidate.listenerChatEnabled : typedFallback.listenerChatEnabled,
    listenerRules: typeof candidate.listenerRules === "string" ? candidate.listenerRules.trim().slice(0, 500) : typedFallback.listenerRules,
    };
  }
  const typedFallback = fallback as PodcastCommunityTypeSettings;
  return {
    kind,
    voiceRoomsEnabled: typeof candidate.voiceRoomsEnabled === "boolean" ? candidate.voiceRoomsEnabled : typedFallback.voiceRoomsEnabled,
    defaultPublisherRole: candidate.defaultPublisherRole === "owner" ? "owner" : "publisher",
    commentsEnabled: typeof candidate.commentsEnabled === "boolean" ? candidate.commentsEnabled : typedFallback.commentsEnabled,
    explicitContentDefault: typeof candidate.explicitContentDefault === "boolean" ? candidate.explicitContentDefault : typedFallback.explicitContentDefault,
    commentRules: typeof candidate.commentRules === "string" ? candidate.commentRules.trim().slice(0, 500) : typedFallback.commentRules,
  };
}

export function isValidCommunityTypeSettings(kind: CommunityKind, value: unknown): value is CommunityTypeSettings {
  if (!value || typeof value !== "object" || (value as { kind?: unknown }).kind !== kind) return false;
  return JSON.stringify(normalizeCommunityTypeSettings(kind, value)) === JSON.stringify(value);
}
