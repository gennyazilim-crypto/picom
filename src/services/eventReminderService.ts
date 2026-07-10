import type { EventRsvpStatus, UpcomingEvent } from "../types/events";
import { dataSourceService } from "./dataSourceService";
import { notificationService } from "./notificationService";
import { settingsService } from "./settingsService";
import { getSupabaseClient } from "./supabase/supabaseClient";

const STORAGE_KEY = "picom.eventReminders.v1";
const timers = new Map<string, number>();
const MAX_TIMER_MS = 2_147_000_000;

function read(): Record<string, number> { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, number>; } catch { return {}; } }
function write(value: Record<string, number>): void { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* restricted fallback */ } }
function clearTimer(eventId: string): void { const timer = timers.get(eventId); if (timer !== undefined) globalThis.clearTimeout(timer); timers.delete(eventId); }

function scheduleTimer(event: UpcomingEvent, minutesBefore: number): void {
  clearTimer(event.id);
  const runAt = Date.parse(event.startsAt) - minutesBefore * 60_000;
  const delay = runAt - Date.now();
  if (delay <= 0) return;
  const timer = globalThis.setTimeout(() => {
    if (delay > MAX_TIMER_MS) { scheduleTimer(event, minutesBefore); return; }
    const settings = settingsService.getSettings().notificationSettings;
    if (!settings.enabled || settings.muted || settings.mentionsOnly) return;
    void notificationService.showNotification({ title: `Upcoming: ${event.title}`, body: `Starts in ${minutesBefore} minutes.`, category: "system", tag: `event-reminder-${event.id}` });
    timers.delete(event.id);
  }, Math.min(delay, MAX_TIMER_MS));
  timers.set(event.id, timer);
}

export const eventReminderService = {
  isEnabled(eventId: string): boolean { return Number.isFinite(read()[eventId]); },
  async set(event: UpcomingEvent, enabled: boolean, rsvp: EventRsvpStatus | undefined, minutesBefore = 15): Promise<boolean> {
    if (enabled && rsvp !== "going" && rsvp !== "interested") return false;
    const safeMinutes = Math.max(5, Math.min(1440, Math.round(minutesBefore)));
    const stored = read(); if (enabled) stored[event.id] = safeMinutes; else delete stored[event.id]; write(stored);
    if (enabled) scheduleTimer(event, safeMinutes); else clearTimer(event.id);
    if (dataSourceService.getStatus().isMock) return true;
    const client = getSupabaseClient(); if (!client) return false;
    if (!enabled) return !(await client.from("community_event_reminders").delete().eq("event_id", event.id)).error;
    const user = await client.auth.getUser(); if (!user.data.user) return false;
    const result = await client.from("community_event_reminders").upsert({ event_id: event.id, user_id: user.data.user.id, minutes_before: safeMinutes, enabled: true }, { onConflict: "event_id,user_id" });
    return !result.error;
  },
  cancel(eventId: string): void { const stored = read(); delete stored[eventId]; write(stored); clearTimer(eventId); },
};
