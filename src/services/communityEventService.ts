import type { EventRsvpStatus, UpcomingEvent, UpcomingEventType } from "../types/events";
import type { CreateEventInput } from "../types/events";
import { eventService } from "./eventService";
import { getSupabaseClient } from "./supabase/supabaseClient";

export type CreateCommunityEventInput = Readonly<{ communityId: string; channelId?: string; title: string; description: string; startsAt: string; endsAt?: string; type: UpcomingEventType; visibility?: "public" | "community_only" | "private"; coverImage?: string; timezone?: string; locationType?: string; locationData?: Record<string, unknown>; metadata?: Record<string, unknown> }>;
export type UpdateCommunityEventInput = Readonly<Omit<CreateCommunityEventInput, "communityId" | "channelId"> & { channelId?: string }>;

type EventRow = { id: string; community_id: string | null; channel_id: string | null; title: string; description: string; starts_at: string; ends_at: string | null; event_type: string; created_by: string; cancelled_at: string | null; created_at: string; updated_at: string; status?: string; visibility?: string; cover_image?: string | null; timezone?: string; location_type?: string; location_data?: unknown; metadata?: unknown; published_at?: string | null; completed_at?: string | null };
function map(row: EventRow): UpcomingEvent {
  const type: UpcomingEventType = ["meeting", "voice", "release", "review", "social", "community_event", "voice_event", "radio_event", "podcast_event", "gaming_event", "announcement"].includes(row.event_type) ? row.event_type as UpcomingEventType : "community_event";
  const locationData = row.location_data && typeof row.location_data === "object" && !Array.isArray(row.location_data) ? row.location_data as Record<string, unknown> : {};
  const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? row.metadata as Record<string, unknown> : {};
  return { id: row.id, communityId: row.community_id ?? "", channelId: row.channel_id ?? undefined, title: row.title, description: row.description, startsAt: row.starts_at, endsAt: row.ends_at ?? undefined, createdBy: row.created_by, cancelledAt: row.cancelled_at ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at, type, status: row.status === "draft" || row.status === "completed" || row.status === "cancelled" ? row.status : "published", visibility: row.visibility === "public" || row.visibility === "private" ? row.visibility : "community_only", coverImage: row.cover_image ?? undefined, scheduleTimezone: row.timezone, locationType: row.location_type, locationData, metadata, publishedAt: row.published_at ?? undefined, completedAt: row.completed_at ?? undefined };
}
function validTimes(startsAt: string, endsAt?: string): boolean {
  const start = Date.parse(startsAt); const end = endsAt ? Date.parse(endsAt) : null;
  return Number.isFinite(start) && (end === null || (Number.isFinite(end) && end > start));
}

export const communityEventService = {
  async listEvents(communityId?: string): Promise<UpcomingEvent[]> {
    const client = getSupabaseClient(); if (!client) return [];
    let query = client.from("community_events").select("id,community_id,channel_id,title,description,starts_at,ends_at,event_type,created_by,cancelled_at,created_at,updated_at,status,visibility,cover_image,timezone,location_type,location_data,metadata,published_at,completed_at").is("cancelled_at", null).order("starts_at");
    if (communityId) query = query.eq("community_id", communityId);
    const { data } = await query; if (!data?.length) return [];
    const rsvps = await client.from("community_event_rsvps").select("event_id,status").in("event_id", data.map((event) => event.id));
    const ownRsvp = new Map((rsvps.data ?? []).map((item) => [item.event_id, item.status as EventRsvpStatus]));
    return data.map((row) => ({ ...map(row as EventRow), currentUserRsvp: ownRsvp.get(row.id) }));
  },
  async createEvent(input: CreateCommunityEventInput): Promise<UpcomingEvent | null> {
    if (!input.title.trim() || input.title.trim().length > 120 || !validTimes(input.startsAt, input.endsAt)) return null;
    const result = await eventService.createEvent({
      title: input.title,
      description: input.description,
      communityId: input.communityId,
      eventType: input.type,
      visibility: input.visibility === "public" || input.visibility === "private" ? input.visibility : "community_only",
      status: "published",
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      timezone: input.timezone,
      locationType: (input.locationType as CreateEventInput["locationType"]) ?? "community",
      locationData: input.locationData,
      coverImage: input.coverImage,
      metadata: input.metadata,
    });
    return result.ok ? result.event : null;
  },
  async updateEvent(eventId: string, input: UpdateCommunityEventInput): Promise<UpcomingEvent | null> {
    if (!input.title.trim() || input.title.trim().length > 120 || !validTimes(input.startsAt, input.endsAt)) return null;
    const updatedAt = new Date().toISOString();
    const client = getSupabaseClient(); if (!client) return null;
    const { data } = await client.from("community_events").update({ channel_id: input.channelId ?? null, title: input.title.trim(), description: input.description.trim().slice(0, 2000), starts_at: input.startsAt, ends_at: input.endsAt ?? null, event_type: input.type as never, visibility: input.visibility ?? "community_only", cover_image: input.coverImage ?? null, timezone: input.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC", location_type: input.locationType ?? "community", location_data: (input.locationData ?? {}) as never, metadata: (input.metadata ?? {}) as never, updated_at: updatedAt }).eq("id", eventId).is("cancelled_at", null).select().single();
    return data ? map(data as EventRow) : null;
  },
  async cancelEvent(eventId: string, reason = "Cancelled by organizer"): Promise<boolean> {
    const event = await eventService.cancelEvent(eventId, reason);
    return Boolean(event);
  },
  async setRsvp(eventId: string, userId: string, status: EventRsvpStatus): Promise<boolean> {
    const client = getSupabaseClient(); if (!client) return false; const auth = await client.auth.getUser(); if (auth.data.user?.id !== userId) return false;
    const result = await eventService.setRsvp(eventId, status);
    return Boolean(result);
  },
};
