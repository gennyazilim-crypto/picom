import type { LiveScreenShareCategory, LiveScreenShareStatus } from "../../types/liveScreenShare";

export type BroadcasterChannelTabId = "home" | "live" | "schedule" | "about";

export const BROADCASTER_CHANNEL_TABS: readonly BroadcasterChannelTabId[] = [
  "home",
  "live",
  "schedule",
  "about",
];

export type LiveBroadcastNotificationMode =
  | "all_live"
  | "scheduled_only"
  | "important_only"
  | "off";

export const LIVE_BROADCAST_NOTIFICATION_MODES: readonly LiveBroadcastNotificationMode[] = [
  "all_live",
  "scheduled_only",
  "important_only",
  "off",
];

export function normalizeLiveBroadcastNotificationMode(
  raw: string | null | undefined,
): LiveBroadcastNotificationMode {
  const mode = String(raw ?? "").trim().toLowerCase();
  if (mode === "all") return "all_live";
  if (mode === "community_member_only") return "important_only";
  if ((LIVE_BROADCAST_NOTIFICATION_MODES as readonly string[]).includes(mode)) {
    return mode as LiveBroadcastNotificationMode;
  }
  return "all_live";
}

export type BroadcasterLiveHero = Readonly<{
  sessionId: string;
  title: string;
  category: LiveScreenShareCategory | string;
  status: Extract<LiveScreenShareStatus, "live" | "reconnecting"> | string;
  startedAt: string;
  viewerCount: number;
  communityId: string;
  channelId: string;
  communityName: string;
  channelName: string;
  languageCode: string;
}>;

export const LIVE_SCHEDULE_CATEGORIES = [
  "livestream",
  "gaming",
  "education",
  "social",
  "workshop",
  "general",
] as const;

export type LiveScheduleCategory = (typeof LIVE_SCHEDULE_CATEGORIES)[number];

export const LIVE_SCHEDULE_VISIBILITIES = ["public", "followers", "community_only"] as const;
export type LiveScheduleVisibility = (typeof LIVE_SCHEDULE_VISIBILITIES)[number];

export const LIVE_SCHEDULE_DURATION_MIN = 5;
export const LIVE_SCHEDULE_DURATION_MAX = 12 * 60;

export type BroadcasterScheduleItem = Readonly<{
  id: string;
  title: string;
  description: string;
  category: string;
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  status: string;
  visibility: string;
  communityId: string | null;
  channelId: string | null;
  communityName: string | null;
  liveSessionId: string | null;
  estimatedDurationMinutes: number | null;
  reminderSet: boolean;
}>;

export type LiveScheduleFormInput = Readonly<{
  title: string;
  description: string;
  category: string;
  scheduledStartAt: string;
  estimatedDurationMinutes: number;
  timezone: string;
  communityId: string | null;
  channelId: string | null;
  visibility: string;
}>;

export type LiveScheduleFormValidation =
  | Readonly<{ ok: true; value: LiveScheduleFormInput & { endsAt: string; category: LiveScheduleCategory; visibility: LiveScheduleVisibility } }>
  | Readonly<{ ok: false; error: string; field?: string }>;

export type BroadcasterSocialLink = Readonly<{
  label: string;
  url: string;
}>;

export function parseBroadcasterChannelTab(value: string | null | undefined): BroadcasterChannelTabId {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "live" || normalized === "canli" || normalized === "canlı") return "live";
  if (normalized === "schedule" || normalized === "program") return "schedule";
  if (normalized === "about" || normalized === "hakkinda" || normalized === "hakkında") return "about";
  return "home";
}

export function broadcasterChannelTabLabel(tab: BroadcasterChannelTabId): string {
  switch (tab) {
    case "live":
      return "Live";
    case "schedule":
      return "Schedule";
    case "about":
      return "About";
    default:
      return "Home";
  }
}

export function parseProfileUsernameParam(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/^@+/, "");
  if (!trimmed || trimmed.length > 64) return null;
  if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

export function buildProfileChannelPath(username: string, tab?: BroadcasterChannelTabId): string {
  const safe = parseProfileUsernameParam(username);
  if (!safe) return "/feed";
  if (!tab || tab === "home") return `/profile/${encodeURIComponent(safe)}`;
  return `/profile/${encodeURIComponent(safe)}?tab=${encodeURIComponent(tab)}`;
}

export function liveNotificationModeLabel(mode: LiveBroadcastNotificationMode): string {
  switch (mode) {
    case "scheduled_only":
      return "Scheduled only";
    case "important_only":
      return "Important only";
    case "off":
      return "Off";
    default:
      return "All live streams";
  }
}

export function isSafeExternalUrl(raw: string): boolean {
  const value = raw.trim();
  if (!value || value.length > 500) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export function sanitizeChannelRules(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, 4000);
}

export function sanitizeSocialLinks(input: unknown): BroadcasterSocialLink[] {
  if (!Array.isArray(input)) return [];
  const links: BroadcasterSocialLink[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const label = String((item as { label?: unknown }).label ?? "").normalize("NFKC").trim().slice(0, 48);
    const url = String((item as { url?: unknown }).url ?? "").trim();
    if (!label || !isSafeExternalUrl(url)) continue;
    links.push({ label, url });
    if (links.length >= 8) break;
  }
  return links;
}

export function formatLiveDuration(startedAt: string, nowMs = Date.now()): string {
  const started = Date.parse(startedAt);
  if (!Number.isFinite(started) || started > nowMs) return "00:00";
  const totalSeconds = Math.floor((nowMs - started) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

export function shouldShowLiveHero(live: BroadcasterLiveHero | null | undefined): live is BroadcasterLiveHero {
  return Boolean(live?.sessionId && (live.status === "live" || live.status === "reconnecting"));
}

export function sanitizeScheduleText(raw: string, max: number): string {
  return raw
    .normalize("NFKC")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);
}

export function validateLiveScheduleForm(input: LiveScheduleFormInput, nowMs = Date.now()): LiveScheduleFormValidation {
  const title = sanitizeScheduleText(input.title, 160);
  const description = sanitizeScheduleText(input.description, 2000);
  const timezone = sanitizeScheduleText(input.timezone || "UTC", 64) || "UTC";
  const categoryRaw = sanitizeScheduleText(input.category, 32).toLowerCase();
  const visibilityRaw = sanitizeScheduleText(input.visibility, 32).toLowerCase();
  const duration = Math.floor(Number(input.estimatedDurationMinutes));
  const startsMs = Date.parse(input.scheduledStartAt);

  if (!title) return { ok: false, error: "Title is required.", field: "title" };
  if (/[\u0000-\u001F\u007F]/.test(input.title) || /[\u0000-\u001F\u007F]/.test(input.description)) {
    return { ok: false, error: "Control characters are not allowed.", field: "title" };
  }
  if (!Number.isFinite(startsMs)) return { ok: false, error: "Start time is invalid.", field: "scheduledStartAt" };
  if (startsMs < nowMs - 60_000) return { ok: false, error: "Start time cannot be in the past.", field: "scheduledStartAt" };
  if (!Number.isFinite(duration) || duration < LIVE_SCHEDULE_DURATION_MIN || duration > LIVE_SCHEDULE_DURATION_MAX) {
    return {
      ok: false,
      error: `Estimated duration must be between ${LIVE_SCHEDULE_DURATION_MIN} and ${LIVE_SCHEDULE_DURATION_MAX} minutes.`,
      field: "estimatedDurationMinutes",
    };
  }
  if (!(LIVE_SCHEDULE_CATEGORIES as readonly string[]).includes(categoryRaw)) {
    return { ok: false, error: "Choose a valid category.", field: "category" };
  }
  if (!(LIVE_SCHEDULE_VISIBILITIES as readonly string[]).includes(visibilityRaw)) {
    return { ok: false, error: "Choose a valid visibility.", field: "visibility" };
  }
  if (visibilityRaw === "community_only" && !input.communityId) {
    return { ok: false, error: "Community is required for community-only visibility.", field: "communityId" };
  }
  if (input.channelId && !input.communityId) {
    return { ok: false, error: "Channel requires a community.", field: "channelId" };
  }

  return {
    ok: true,
    value: {
      title,
      description,
      category: categoryRaw as LiveScheduleCategory,
      scheduledStartAt: new Date(startsMs).toISOString(),
      estimatedDurationMinutes: duration,
      timezone,
      communityId: input.communityId,
      channelId: input.channelId,
      visibility: visibilityRaw as LiveScheduleVisibility,
      endsAt: new Date(startsMs + duration * 60_000).toISOString(),
    },
  };
}

export type ScheduleBucket = "upcoming" | "live_now" | "completed" | "cancelled";

export function scheduleBucket(item: BroadcasterScheduleItem, nowMs = Date.now()): ScheduleBucket {
  if (item.status === "cancelled") return "cancelled";
  if (item.status === "live" || item.liveSessionId) return "live_now";
  if (item.status === "completed") return "completed";
  const starts = Date.parse(item.startsAt);
  if (Number.isFinite(starts) && starts < nowMs - 60_000 && !item.liveSessionId) return "completed";
  return "upcoming";
}

export function scheduleItemToUpcomingEvent(item: BroadcasterScheduleItem): {
  id: string;
  communityId: string;
  title: string;
  description?: string;
  startsAt: string;
  endsAt?: string;
  type: "livestream";
  scheduleTimezone?: string;
} {
  return {
    id: item.id,
    communityId: item.communityId ?? "",
    title: item.title,
    description: item.description,
    startsAt: item.startsAt,
    endsAt: item.endsAt ?? undefined,
    type: "livestream",
    scheduleTimezone: item.timezone,
  };
}
