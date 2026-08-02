import type { RealtimeChannel } from "@supabase/supabase-js";
import type {
  CreateEventInput,
  EventInvitation,
  EventListFilter,
  EventRsvpResult,
  EventRsvpStatus,
  EventStatus,
  EventVisibility,
  UpcomingEvent,
  UpcomingEventType,
} from "../types/events";
import { validateCreateEventInput, sanitizeEventText, normalizeInviteEmail } from "../features/events/validation/eventValidation";
import { getSupabaseClient } from "./supabase/supabaseClient";

export type EventComment = Readonly<{ id: string; eventId: string; userId: string; content: string; createdAt: string; updatedAt: string }>;

type RpcClient = {
  rpc: (fn: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

function rpc(client: NonNullable<ReturnType<typeof getSupabaseClient>>, name: string, args: Record<string, unknown>) {
  return (client as unknown as RpcClient).rpc(name, args);
}

type EventRow = Readonly<{
  id: string;
  community_id: string | null;
  channel_id: string | null;
  title: string;
  short_description: string | null;
  description: string;
  starts_at: string;
  ends_at: string | null;
  event_type: string;
  category: string | null;
  created_by: string;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
  status: string;
  visibility: string;
  cover_image: string | null;
  timezone: string;
  location_type: string;
  location_data: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  published_at: string | null;
  completed_at: string | null;
  live_at: string | null;
  featured_until: string | null;
  capacity: number | null;
  approval_required: boolean | null;
  attendee_visibility: string | null;
  chat_enabled: boolean | null;
  language: string | null;
  age_limit: number | null;
  rules: string | null;
  tags: string[] | null;
  is_all_day: boolean | null;
  recurrence_rule: string | null;
  external_meeting_url: string | null;
  livekit_room_name: string | null;
}>;

type EventCountRow = Readonly<{ event_id: string; attendee_count: number; going_count?: number; waitlist_count?: number }>;
type EventRsvpRow = Readonly<{ event_id: string; status: EventRsvpStatus }>;
type EventReminderRow = Readonly<{ event_id: string }>;
type EventCommentRow = Readonly<{ id: string; event_id: string; user_id: string; content: string; created_at: string; updated_at: string }>;
type InviteRow = Readonly<{ id: string; event_id: string; user_id: string | null; invited_email: string | null; status: string; expires_at: string | null; created_at: string }>;

const EVENT_SELECT = "id,community_id,channel_id,title,short_description,description,starts_at,ends_at,event_type,category,created_by,cancelled_at,cancellation_reason,created_at,updated_at,status,visibility,cover_image,timezone,location_type,location_data,metadata,published_at,completed_at,live_at,featured_until,capacity,approval_required,attendee_visibility,chat_enabled,language,age_limit,rules,tags,is_all_day,recurrence_rule,external_meeting_url,livekit_room_name";

const eventTypes: readonly UpcomingEventType[] = [
  "meeting", "voice", "release", "review", "social", "community_event", "voice_event", "radio_event",
  "podcast_event", "gaming_event", "announcement", "general", "private", "invite_only", "online",
  "physical", "video", "livestream", "tournament", "workshop", "conference", "education", "game",
];

function mapStatus(value: string): EventStatus {
  if (value === "draft" || value === "live" || value === "completed" || value === "cancelled" || value === "published") return value;
  return "published";
}

function mapVisibility(value: string): EventVisibility {
  if (value === "public" || value === "followers" || value === "private" || value === "secret" || value === "community_only") return value;
  return "community_only";
}

function mapEvent(row: EventRow, extras?: {
  rsvp?: EventRsvpStatus;
  attendeeCount?: number;
  goingCount?: number;
  waitlistCount?: number;
  reminderSet?: boolean;
  inviteStatus?: UpcomingEvent["inviteStatus"];
}): UpcomingEvent {
  const type = eventTypes.includes(row.event_type as UpcomingEventType) ? row.event_type as UpcomingEventType : "general";
  return {
    id: row.id,
    communityId: row.community_id ?? "",
    channelId: row.channel_id ?? undefined,
    title: row.title,
    shortDescription: row.short_description ?? undefined,
    description: row.description,
    startsAt: row.starts_at,
    endsAt: row.ends_at ?? undefined,
    attendeeCount: extras?.attendeeCount ?? 0,
    goingCount: extras?.goingCount ?? 0,
    waitlistCount: extras?.waitlistCount ?? 0,
    capacity: row.capacity,
    type,
    category: (row.category as UpcomingEvent["category"]) ?? "general",
    createdBy: row.created_by,
    cancelledAt: row.cancelled_at ?? undefined,
    cancellationReason: row.cancellation_reason ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    currentUserRsvp: extras?.rsvp,
    reminderSet: extras?.reminderSet ?? false,
    scheduleTimezone: row.timezone,
    status: mapStatus(row.status),
    visibility: mapVisibility(row.visibility),
    coverImage: row.cover_image ?? undefined,
    locationType: row.location_type,
    locationData: row.location_data ?? {},
    metadata: row.metadata ?? {},
    publishedAt: row.published_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    liveAt: row.live_at ?? undefined,
    featuredUntil: row.featured_until ?? undefined,
    approvalRequired: row.approval_required ?? false,
    attendeeVisibility: row.attendee_visibility ?? "attendees",
    chatEnabled: row.chat_enabled ?? true,
    language: row.language ?? undefined,
    ageLimit: row.age_limit,
    rules: row.rules ?? undefined,
    tags: row.tags ?? [],
    isAllDay: row.is_all_day ?? false,
    recurrenceRule: row.recurrence_rule ?? undefined,
    externalMeetingUrl: row.external_meeting_url ?? undefined,
    livekitRoomName: row.livekit_room_name ?? undefined,
    inviteStatus: extras?.inviteStatus,
  };
}

async function enrichEvents(events: EventRow[]): Promise<UpcomingEvent[]> {
  const client = getSupabaseClient();
  if (!client || !events.length) return events.map((event) => mapEvent(event));
  const ids = events.map((event) => event.id);
  const [counts, rsvps, reminders, invites] = await Promise.all([
    client.rpc("event_attendee_counts", { target_event_ids: ids }),
    client.from("community_event_rsvps").select("event_id,status").in("event_id", ids),
    client.from("community_event_reminders").select("event_id").in("event_id", ids).eq("enabled", true),
    client.from("event_invitations").select("event_id,status").in("event_id", ids).in("status", ["pending", "accepted"]),
  ]);
  const countByEvent = new Map((counts.data as unknown as EventCountRow[] | null ?? []).map((item) => [item.event_id, item]));
  const rsvpByEvent = new Map((rsvps.data as unknown as EventRsvpRow[] | null ?? []).map((item) => [item.event_id, item.status]));
  const remindersByEvent = new Set((reminders.data as unknown as EventReminderRow[] | null ?? []).map((item) => item.event_id));
  const inviteByEvent = new Map((invites.data as { event_id: string; status: string }[] | null ?? []).map((item) => [item.event_id, item.status as UpcomingEvent["inviteStatus"]]));
  return events.map((event) => {
    const countsRow = countByEvent.get(event.id);
    return mapEvent(event, {
      rsvp: rsvpByEvent.get(event.id),
      attendeeCount: countsRow?.attendee_count ?? 0,
      goingCount: countsRow?.going_count ?? 0,
      waitlistCount: countsRow?.waitlist_count ?? 0,
      reminderSet: remindersByEvent.has(event.id),
      inviteStatus: inviteByEvent.get(event.id),
    });
  });
}

export type ListEventsOptions = Readonly<{
  filter?: EventListFilter;
  communityId?: string;
  search?: string;
  limit?: number;
  signal?: AbortSignal;
}>;

async function listEvents(options: ListEventsOptions = {}): Promise<UpcomingEvent[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 250);
  const nowIso = new Date().toISOString();
  let query = client.from("community_events").select(EVENT_SELECT).limit(limit);

  const filter = options.filter ?? "upcoming";
  if (options.communityId) query = query.eq("community_id", options.communityId);

  switch (filter) {
    case "past":
      query = query.or(`ends_at.lt.${nowIso},and(ends_at.is.null,starts_at.lt.${nowIso})`).order("starts_at", { ascending: false });
      break;
    case "created": {
      const { data: auth } = await client.auth.getUser();
      if (!auth.user) return [];
      query = query.eq("created_by", auth.user.id).order("starts_at", { ascending: false });
      break;
    }
    case "discover":
      query = query.eq("visibility", "public").in("status", ["published", "live"] as never).gte("starts_at", nowIso).order("starts_at", { ascending: true });
      break;
    default:
      query = query.in("status", ["published", "live"] as never).is("cancelled_at", null).gte("starts_at", nowIso).order("starts_at", { ascending: true });
  }

  if (options.search?.trim()) {
    const q = options.search.trim().replace(/[%_,]/g, " ");
    query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%,short_description.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error || !data?.length) return [];
  let events = await enrichEvents(data as unknown as EventRow[]);

  if (filter === "going") events = events.filter((event) => event.currentUserRsvp === "going" || event.currentUserRsvp === "maybe");
  if (filter === "invites") events = events.filter((event) => event.inviteStatus === "pending");
  if (filter === "today") {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    events = events.filter((event) => {
      const t = Date.parse(event.startsAt);
      return t >= start.getTime() && t <= end.getTime();
    });
  }
  if (filter === "week") {
    const end = Date.now() + 7 * 24 * 60 * 60 * 1000;
    events = events.filter((event) => Date.parse(event.startsAt) <= end);
  }
  if (filter === "month") {
    const end = Date.now() + 30 * 24 * 60 * 60 * 1000;
    events = events.filter((event) => Date.parse(event.startsAt) <= end);
  }
  if (filter === "online") {
    events = events.filter((event) => ["voice_room", "video_room", "external", "online"].includes(String(event.locationType)));
  }
  if (filter === "community") {
    events = events.filter((event) => Boolean(event.communityId));
  }

  if (options.signal?.aborted) return [];
  return events;
}

async function listFeatured(limit = 6): Promise<UpcomingEvent[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const nowIso = new Date().toISOString();
  const { data } = await client
    .from("community_events")
    .select(EVENT_SELECT)
    .in("status", ["published", "live"] as never)
    .is("cancelled_at", null)
    .gte("starts_at", nowIso)
    .not("featured_until", "is", null)
    .gte("featured_until", nowIso)
    .order("featured_until", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 20)));
  if (data?.length) return enrichEvents(data as unknown as EventRow[]);
  return listEvents({ filter: "upcoming", limit });
}

async function getFeaturedEvent(): Promise<UpcomingEvent | null> {
  const featured = await listFeatured(1);
  return featured[0] ?? null;
}

async function getEvent(eventId: string): Promise<UpcomingEvent | null> {
  const client = getSupabaseClient();
  if (!client || !eventId) return null;
  const { data, error } = await client.from("community_events").select(EVENT_SELECT).eq("id", eventId).maybeSingle();
  if (error || !data) return null;
  const [event] = await enrichEvents([data as unknown as EventRow]);
  return event ?? null;
}

async function createEvent(input: CreateEventInput): Promise<{ ok: true; event: UpcomingEvent } | { ok: false; issues: ReturnType<typeof validateCreateEventInput> }> {
  const issues = validateCreateEventInput({
    ...input,
    title: sanitizeEventText(input.title, 120),
    shortDescription: input.shortDescription ? sanitizeEventText(input.shortDescription, 280) : undefined,
    description: input.description ? sanitizeEventText(input.description, 5000) : undefined,
  });
  if (issues.length) return { ok: false, issues };
  const client = getSupabaseClient();
  if (!client) return { ok: false, issues: [{ field: "form", message: "Supabase is unavailable." }] };

  const { data, error } = await rpc(client, "create_picom_event", {
    payload: {
      title: sanitizeEventText(input.title, 120),
      shortDescription: input.shortDescription ? sanitizeEventText(input.shortDescription, 280) : null,
      description: input.description ? sanitizeEventText(input.description, 5000) : "",
      communityId: input.communityId ?? null,
      eventType: input.eventType ?? "general",
      category: input.category ?? "general",
      visibility: input.visibility ?? "public",
      status: input.status ?? "draft",
      startsAt: input.startsAt,
      endsAt: input.endsAt ?? null,
      timezone: input.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
      isAllDay: input.isAllDay ?? false,
      locationType: input.locationType ?? "none",
      locationData: input.locationData ?? {},
      capacity: input.capacity ?? null,
      approvalRequired: input.approvalRequired ?? false,
      attendeeVisibility: input.attendeeVisibility ?? "attendees",
      chatEnabled: input.chatEnabled ?? true,
      language: input.language ?? null,
      ageLimit: input.ageLimit ?? null,
      rules: input.rules ?? null,
      cancellationPolicy: input.cancellationPolicy ?? null,
      recurrenceRule: input.recurrenceRule ?? null,
      tags: input.tags ?? [],
      coverImage: input.coverImage ?? null,
      externalMeetingUrl: input.externalMeetingUrl ?? null,
      livekitRoomName: input.livekitRoomName ?? null,
      metadata: input.metadata ?? {},
    },
  });
  if (error || !data) {
    return { ok: false, issues: [{ field: "form", message: error?.message ?? "Could not create event." }] };
  }
  const [event] = await enrichEvents([data as unknown as EventRow]);
  if (!event) return { ok: false, issues: [{ field: "form", message: "Event created but could not be loaded." }] };
  return { ok: true, event };
}

async function publishEvent(eventId: string): Promise<UpcomingEvent | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await rpc(client, "publish_picom_event", { target_event_id: eventId });
  if (error || !data) return null;
  const [event] = await enrichEvents([data as unknown as EventRow]);
  return event ?? null;
}

async function cancelEvent(eventId: string, reason: string): Promise<UpcomingEvent | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await rpc(client, "cancel_picom_event", { target_event_id: eventId, reason });
  if (error || !data) return null;
  const [event] = await enrichEvents([data as unknown as EventRow]);
  return event ?? null;
}

async function setRsvp(eventId: string, status: EventRsvpStatus): Promise<EventRsvpResult | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await rpc(client, "set_community_event_rsvp", { target_event_id: eventId, next_status: status });
  if (error || !data) return null;
  if (data === true) return { status };
  const payload = data as { status?: EventRsvpStatus; waitlistPosition?: number | null };
  if (!payload.status) return null;
  return { status: payload.status, waitlistPosition: payload.waitlistPosition ?? null };
}

async function scheduleReminder(eventId: string, minutesBefore: number, channel: "app" | "email" | "native" | "web" = "app"): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  const { error } = await rpc(client, "schedule_event_reminders", {
    target_event_id: eventId,
    minutes_before: minutesBefore,
    reminder_channel: channel,
  });
  return !error;
}

async function inviteUser(eventId: string, userId: string): Promise<EventInvitation | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await rpc(client, "invite_to_event", {
    target_event_id: eventId,
    invited_user: userId,
    invited_email_raw: null,
    token_hash_value: null,
    expires_in_hours: 168,
  });
  if (error || !data) return null;
  const row = data as InviteRow;
  return { id: row.id, eventId: row.event_id, userId: row.user_id, invitedEmail: row.invited_email, status: row.status as EventInvitation["status"], expiresAt: row.expires_at, createdAt: row.created_at };
}

async function inviteEmail(eventId: string, email: string, tokenHash: string): Promise<EventInvitation | null> {
  const normalized = normalizeInviteEmail(email);
  if (!normalized || !tokenHash) return null;
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await rpc(client, "invite_to_event", {
    target_event_id: eventId,
    invited_user: null,
    invited_email_raw: normalized,
    token_hash_value: tokenHash,
    expires_in_hours: 168,
  });
  if (error || !data) return null;
  const row = data as InviteRow;
  return { id: row.id, eventId: row.event_id, userId: row.user_id, invitedEmail: row.invited_email, status: row.status as EventInvitation["status"], expiresAt: row.expires_at, createdAt: row.created_at };
}

async function acceptInvite(inviteId: string, tokenHash?: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  const { error } = await rpc(client, "accept_event_invite", { invite_id: inviteId, provided_token_hash: tokenHash ?? null });
  return !error;
}

async function declineInvite(inviteId: string, tokenHash?: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  const { error } = await rpc(client, "decline_event_invite", { invite_id: inviteId, provided_token_hash: tokenHash ?? null });
  return !error;
}

async function listInvites(eventId: string): Promise<EventInvitation[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const result = await client.from("event_invitations").select("id,event_id,user_id,invited_email,status,expires_at,created_at").eq("event_id", eventId).order("created_at", { ascending: false });
  if (result.error || !result.data) return [];
  return (result.data as unknown as InviteRow[]).map((row) => ({
    id: row.id,
    eventId: row.event_id,
    userId: row.user_id,
    invitedEmail: row.invited_email,
    status: row.status as EventInvitation["status"],
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }));
}

async function uploadCover(file: File): Promise<string | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type) || file.size > 5 * 1024 * 1024) return null;
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return null;
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${auth.user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await client.storage.from("event-covers").upload(path, file, { contentType: file.type, upsert: false });
  if (error) return null;
  const { data } = client.storage.from("event-covers").getPublicUrl(path);
  return data.publicUrl || null;
}

async function listComments(eventId: string): Promise<EventComment[]> {
  const client = getSupabaseClient();
  if (!client || !eventId) return [];
  const { data, error } = await client.from("event_comments").select("id,event_id,user_id,content,created_at,updated_at").eq("event_id", eventId).order("created_at", { ascending: true }).limit(100);
  if (error || !data) return [];
  return (data as unknown as EventCommentRow[]).map((row) => ({ id: row.id, eventId: row.event_id, userId: row.user_id, content: row.content, createdAt: row.created_at, updatedAt: row.updated_at }));
}

async function addComment(eventId: string, content: string): Promise<EventComment | null> {
  const cleanContent = sanitizeEventText(content, 2000);
  const client = getSupabaseClient();
  if (!client || !eventId || !cleanContent) return null;
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await client.from("event_comments").insert({ event_id: eventId, user_id: auth.user.id, content: cleanContent }).select("id,event_id,user_id,content,created_at,updated_at").single();
  if (error || !data) return null;
  const row = data as unknown as EventCommentRow;
  return { id: row.id, eventId: row.event_id, userId: row.user_id, content: row.content, createdAt: row.created_at, updatedAt: row.updated_at };
}

function subscribe(onChange: () => void): () => void {
  const client = getSupabaseClient();
  if (!client) return () => undefined;
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const channel: RealtimeChannel = client
    .channel(`events:${id}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "community_events" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "community_event_rsvps" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "event_comments" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "event_invitations" }, onChange)
    .subscribe();
  return () => { void client.removeChannel(channel); };
}

export const eventService = {
  listEvents,
  getEvent,
  getFeaturedEvent,
  listFeatured,
  createEvent,
  publishEvent,
  cancelEvent,
  setRsvp,
  scheduleReminder,
  inviteUser,
  inviteEmail,
  acceptInvite,
  declineInvite,
  listInvites,
  uploadCover,
  listComments,
  addComment,
  subscribe,
};
