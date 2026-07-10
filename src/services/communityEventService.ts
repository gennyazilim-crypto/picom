import { mockUpcomingEvents } from "../data/mockEvents";
import type { EventRsvpStatus, UpcomingEvent, UpcomingEventType } from "../types/events";
import { dataSourceService } from "./dataSourceService";
import { getSupabaseClient } from "./supabase/supabaseClient";

let mockEvents: UpcomingEvent[] = [...mockUpcomingEvents];
const mockRsvps = new Map<string, EventRsvpStatus>();

export type CreateCommunityEventInput = Readonly<{ communityId: string; channelId?: string; title: string; description: string; startsAt: string; endsAt?: string; type: UpcomingEventType }>;
export type UpdateCommunityEventInput = Readonly<Omit<CreateCommunityEventInput, "communityId" | "channelId"> & { channelId?: string }>;

type EventRow = { id: string; community_id: string; channel_id: string | null; title: string; description: string; starts_at: string; ends_at: string | null; event_type: string; created_by: string; cancelled_at: string | null; created_at: string; updated_at: string };
function map(row: EventRow): UpcomingEvent {
  const type: UpcomingEventType = ["meeting", "voice", "release", "review", "social"].includes(row.event_type) ? row.event_type as UpcomingEventType : "meeting";
  return { id: row.id, communityId: row.community_id, channelId: row.channel_id ?? undefined, title: row.title, description: row.description, startsAt: row.starts_at, endsAt: row.ends_at ?? undefined, createdBy: row.created_by, cancelledAt: row.cancelled_at ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at, type };
}
function validTimes(startsAt: string, endsAt?: string): boolean {
  const start = Date.parse(startsAt); const end = endsAt ? Date.parse(endsAt) : null;
  return Number.isFinite(start) && (end === null || (Number.isFinite(end) && end > start));
}

export const communityEventService = {
  async listEvents(communityId?: string): Promise<UpcomingEvent[]> {
    if (dataSourceService.getStatus().isMock) return mockEvents.filter((event) => !communityId || event.communityId === communityId).map((event) => ({ ...event, currentUserRsvp: mockRsvps.get(event.id) }));
    const client = getSupabaseClient(); if (!client) return [];
    let query = client.from("community_events").select("id,community_id,channel_id,title,description,starts_at,ends_at,event_type,created_by,cancelled_at,created_at,updated_at").is("cancelled_at", null).order("starts_at");
    if (communityId) query = query.eq("community_id", communityId);
    const { data } = await query; if (!data?.length) return [];
    const rsvps = await client.from("community_event_rsvps").select("event_id,status").in("event_id", data.map((event) => event.id));
    const ownRsvp = new Map((rsvps.data ?? []).map((item) => [item.event_id, item.status as EventRsvpStatus]));
    return data.map((row) => ({ ...map(row), currentUserRsvp: ownRsvp.get(row.id) }));
  },
  async createEvent(input: CreateCommunityEventInput): Promise<UpcomingEvent | null> {
    if (!input.title.trim() || input.title.trim().length > 120 || !validTimes(input.startsAt, input.endsAt)) return null;
    if (dataSourceService.getStatus().isMock) { const now = new Date().toISOString(); const event: UpcomingEvent = { id: `event-${crypto.randomUUID()}`, communityId: input.communityId, channelId: input.channelId, title: input.title.trim(), description: input.description.trim().slice(0, 2000), startsAt: input.startsAt, endsAt: input.endsAt, type: input.type, attendeeCount: 1, createdBy: "mock-current-user", createdAt: now, updatedAt: now }; mockEvents = [event, ...mockEvents]; return event; }
    const client = getSupabaseClient(); if (!client) return null; const { data: user } = await client.auth.getUser(); if (!user.user) return null;
    const { data } = await client.from("community_events").insert({ community_id: input.communityId, channel_id: input.channelId ?? null, title: input.title.trim(), description: input.description.trim().slice(0, 2000), starts_at: input.startsAt, ends_at: input.endsAt ?? null, event_type: input.type, created_by: user.user.id }).select().single();
    return data ? map(data) : null;
  },
  async updateEvent(eventId: string, input: UpdateCommunityEventInput): Promise<UpcomingEvent | null> {
    if (!input.title.trim() || input.title.trim().length > 120 || !validTimes(input.startsAt, input.endsAt)) return null;
    const updatedAt = new Date().toISOString();
    if (dataSourceService.getStatus().isMock) { let updated: UpcomingEvent | null = null; mockEvents = mockEvents.map((event) => { if (event.id !== eventId) return event; updated = { ...event, title: input.title.trim(), description: input.description.trim().slice(0, 2000), startsAt: input.startsAt, endsAt: input.endsAt, type: input.type, updatedAt }; return updated; }); return updated; }
    const client = getSupabaseClient(); if (!client) return null;
    const { data } = await client.from("community_events").update({ channel_id: input.channelId ?? null, title: input.title.trim(), description: input.description.trim().slice(0, 2000), starts_at: input.startsAt, ends_at: input.endsAt ?? null, event_type: input.type, updated_at: updatedAt }).eq("id", eventId).is("cancelled_at", null).select().single();
    return data ? map(data) : null;
  },
  async cancelEvent(eventId: string): Promise<boolean> {
    const now = new Date().toISOString();
    if (dataSourceService.getStatus().isMock) { mockEvents = mockEvents.map((event) => event.id === eventId ? { ...event, cancelledAt: now, updatedAt: now } : event); return true; }
    const client = getSupabaseClient(); if (!client) return false; const { error } = await client.from("community_events").update({ cancelled_at: now, updated_at: now }).eq("id", eventId).is("cancelled_at", null); return !error;
  },
  async setRsvp(eventId: string, userId: string, status: EventRsvpStatus): Promise<boolean> {
    if (dataSourceService.getStatus().isMock) { mockRsvps.set(eventId, status); return true; }
    const client = getSupabaseClient(); if (!client) return false; const auth = await client.auth.getUser(); if (auth.data.user?.id !== userId) return false;
    const result = await client.rpc("set_community_event_rsvp", { target_event_id: eventId, next_status: status });
    return !result.error && result.data === true;
  },
};
