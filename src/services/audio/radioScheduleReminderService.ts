import { currentUserId } from "../../data/mockCommunities";
import type { RadioScheduleReminder, RadioSession } from "../../types/audio";
import { dataSourceService } from "../dataSourceService";
import { decideNotificationRoute, notificationService } from "../notificationService";
import { notificationCenterService } from "../notificationCenterService";
import type { Database } from "../supabase/database.types";
import { getSupabaseClient } from "../supabase/supabaseClient";
import { dateTimeService } from "../dateTimeService";

type ReminderRow = Database["public"]["Tables"]["radio_session_reminders"]["Row"];
type ReminderResult<T> = Readonly<{ ok: true; data: T }> | Readonly<{ ok: false; error: string }>;
type ReminderEventKind = "schedule_changed" | "cancelled" | "live" | "starts_soon" | "stale";
type ReminderEvent = Readonly<{ kind: ReminderEventKind; key: string }>;
type Listener = (reminders: readonly RadioScheduleReminder[]) => void;

const STORAGE_KEY = "picom.radioScheduleReminders.v1";
const DEFAULT_LEAD_MINUTES = 15;
const listeners = new Set<Listener>();
let cached: RadioScheduleReminder[] | null = null;
let refreshInFlight: Promise<ReminderResult<RadioScheduleReminder[]>> | null = null;

const ok = <T,>(data: T): ReminderResult<T> => ({ ok: true, data });
const fail = <T,>(error: string): ReminderResult<T> => ({ ok: false, error });

function clone(reminders: readonly RadioScheduleReminder[]): RadioScheduleReminder[] {
  return reminders.map((reminder) => ({ ...reminder }));
}

function publish(reminders: readonly RadioScheduleReminder[]): void {
  cached = clone(reminders);
  const snapshot = clone(cached);
  listeners.forEach((listener) => listener(snapshot));
}

function readMock(): RadioScheduleReminder[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as RadioScheduleReminder[];
    return Array.isArray(parsed)
      ? parsed.filter((item) => item && item.userId === currentUserId && typeof item.radioSessionId === "string")
      : [];
  } catch {
    return [];
  }
}

function writeMock(reminders: readonly RadioScheduleReminder[]): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
    } catch {
      // Restricted desktop storage falls back to the in-memory snapshot.
    }
  }
  publish(reminders);
}

function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "radio-reminder-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
}

function mapRow(row: ReminderRow): RadioScheduleReminder {
  return {
    id: row.id,
    radioSessionId: row.radio_session_id,
    userId: row.user_id,
    remindMinutesBefore: row.remind_minutes_before,
    lastKnownStartsAt: row.last_known_starts_at,
    lastKnownStatus: row.last_known_status,
    lastNotificationKey: row.last_notification_key ?? undefined,
    lastNotifiedAt: row.last_notified_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function refreshReminders(): Promise<ReminderResult<RadioScheduleReminder[]>> {
  if (refreshInFlight) return refreshInFlight;
  const pending = (async (): Promise<ReminderResult<RadioScheduleReminder[]>> => {
    if (dataSourceService.getStatus().isMock) {
      const reminders = readMock();
      publish(reminders);
      return ok(reminders);
    }
    const client = getSupabaseClient();
    if (!client) return fail("Radio reminders are unavailable while Supabase is not configured.");
    const { data: authData } = await client.auth.getUser();
    if (!authData.user) return fail("Sign in again before managing Radio reminders.");
    const result = await client
      .from("radio_session_reminders")
      .select("id,radio_session_id,user_id,remind_minutes_before,last_known_starts_at,last_known_status,last_notification_key,last_notified_at,created_at,updated_at")
      .eq("user_id", authData.user.id)
      .order("last_known_starts_at", { ascending: true });
    if (result.error) return fail("Picom could not load your Radio reminders.");
    const reminders = (result.data ?? []).map(mapRow);
    publish(reminders);
    return ok(reminders);
  })().finally(() => {
    refreshInFlight = null;
  });
  refreshInFlight = pending;
  return pending;
}

async function toggleReminder(session: RadioSession): Promise<ReminderResult<boolean>> {
  if (session.status !== "scheduled") return fail("Reminders can only be set for scheduled Radio shows.");
  const currentResult = cached ? ok(clone(cached)) : await refreshReminders();
  if (!currentResult.ok) return currentResult;
  const existing = currentResult.data.find((item) => item.radioSessionId === session.id);

  if (dataSourceService.getStatus().isMock) {
    if (existing) {
      writeMock(currentResult.data.filter((item) => item.id !== existing.id));
      return ok(false);
    }
    const now = new Date().toISOString();
    writeMock([...currentResult.data, {
      id: randomId(),
      radioSessionId: session.id,
      userId: currentUserId,
      remindMinutesBefore: DEFAULT_LEAD_MINUTES,
      lastKnownStartsAt: session.startsAt,
      lastKnownStatus: session.status,
      createdAt: now,
      updatedAt: now,
    }]);
    return ok(true);
  }

  const client = getSupabaseClient();
  if (!client) return fail("Radio reminders are unavailable while Supabase is not configured.");
  const { data: authData } = await client.auth.getUser();
  if (!authData.user) return fail("Sign in again before managing Radio reminders.");
  if (existing) {
    const result = await client.from("radio_session_reminders").delete().eq("id", existing.id).eq("user_id", authData.user.id);
    if (result.error) return fail("Picom could not remove that reminder.");
    publish(currentResult.data.filter((item) => item.id !== existing.id));
    return ok(false);
  }
  const result = await client.from("radio_session_reminders").insert({
    radio_session_id: session.id,
    user_id: authData.user.id,
    remind_minutes_before: DEFAULT_LEAD_MINUTES,
    last_known_starts_at: session.startsAt,
    last_known_status: session.status,
  }).select("id,radio_session_id,user_id,remind_minutes_before,last_known_starts_at,last_known_status,last_notification_key,last_notified_at,created_at,updated_at").single();
  if (result.error || !result.data) return fail("Picom could not save that reminder.");
  publish([...currentResult.data, mapRow(result.data)]);
  return ok(true);
}

function eventFor(reminder: RadioScheduleReminder, session: RadioSession, now: Date): ReminderEvent | null {
  if (session.status === "cancelled" && reminder.lastKnownStatus !== "cancelled") return { kind: "cancelled", key: "cancelled:" + session.startsAt };
  if (session.startsAt !== reminder.lastKnownStartsAt) return { kind: "schedule_changed", key: "schedule-changed:" + session.startsAt };
  if (session.status === "live" && reminder.lastKnownStatus !== "live") return { kind: "live", key: "live:" + session.startsAt };
  if (session.status === "ended" && reminder.lastKnownStatus !== "ended") return { kind: "stale", key: "ended:" + session.startsAt };
  if (session.status === "scheduled") {
    const startsAt = Date.parse(session.startsAt);
    const leadMs = reminder.remindMinutesBefore * 60_000;
    if (Number.isFinite(startsAt) && now.getTime() >= startsAt - leadMs && now.getTime() < startsAt + 15 * 60_000) {
      return { kind: "starts_soon", key: "starts-soon:" + session.startsAt + ":" + reminder.remindMinutesBefore };
    }
  }
  return null;
}

async function claimEvent(reminder: RadioScheduleReminder, session: RadioSession, event: ReminderEvent): Promise<ReminderResult<boolean>> {
  if (reminder.lastNotificationKey === event.key) return ok(false);
  const updated: RadioScheduleReminder = { ...reminder, lastKnownStartsAt: session.startsAt, lastKnownStatus: session.status, lastNotificationKey: event.key, lastNotifiedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  if (dataSourceService.getStatus().isMock) {
    const current = cached ?? readMock();
    writeMock(current.map((item) => item.id === reminder.id ? updated : item));
    return ok(true);
  }
  const client = getSupabaseClient();
  if (!client) return fail("Radio reminder synchronization is unavailable.");
  const result = await client.rpc("claim_radio_session_reminder_event", { target_reminder_id: reminder.id, event_key: event.key, event_starts_at: session.startsAt, event_status: session.status });
  if (result.error) return fail("Picom could not synchronize a Radio reminder.");
  if (result.data === true) publish((cached ?? []).map((item) => item.id === reminder.id ? updated : item));
  return ok(result.data === true);
}

function eventCopy(event: ReminderEvent, session: RadioSession): { title: string; preview: string } {
  const when = dateTimeService.formatCompactDateTime(session.startsAt);
  if (event.kind === "cancelled") return { title: "Radio show cancelled", preview: session.title + " was cancelled." };
  if (event.kind === "schedule_changed") return { title: "Radio schedule changed", preview: session.title + " moved to " + when + "." };
  if (event.kind === "live") return { title: "Radio show is live", preview: session.title + " is now on air." };
  return { title: "Radio show starts soon", preview: session.title + " starts at " + when + "." };
}

function hash(value: string): string {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

async function dispatchEvent(reminder: RadioScheduleReminder, session: RadioSession, event: ReminderEvent): Promise<void> {
  if (event.kind === "stale") return;
  const copy = eventCopy(event, session);
  const route = decideNotificationRoute({ category: "system", communityId: session.communityId });
  const notificationId = "radio-" + reminder.id + "-" + hash(event.key);
  if (route.inbox) {
    notificationCenterService.add({
      id: notificationId,
      category: "event",
      title: copy.title,
      preview: copy.preview,
      createdAt: new Date().toISOString(),
      context: { kind: "community", communityId: session.communityId, channelId: session.channelId, label: "Radio schedule" },
    });
  }
  if (route.desktop && notificationService.getPermission() === "granted") {
    await notificationService.showNotification({ title: copy.title, body: copy.preview, category: "system", tag: notificationId, routing: { communityId: session.communityId, channelId: session.channelId } });
  }
}

async function syncSessions(sessions: readonly RadioSession[], now = new Date()): Promise<ReminderResult<number>> {
  const currentResult = cached ? ok(clone(cached)) : await refreshReminders();
  if (!currentResult.ok) return currentResult;
  const sessionsById = new Map(sessions.map((session) => [session.id, session]));
  let delivered = 0;
  for (const reminder of currentResult.data) {
    const session = sessionsById.get(reminder.radioSessionId);
    if (!session) continue;
    const event = eventFor(reminder, session, now);
    if (!event) continue;
    const claimed = await claimEvent(reminder, session, event);
    if (!claimed.ok) return claimed;
    if (claimed.data) {
      delivered += 1;
      await dispatchEvent(reminder, session, event);
    }
  }
  return ok(delivered);
}

export const radioScheduleReminderService = {
  getSnapshot(): readonly RadioScheduleReminder[] {
    if (!cached && dataSourceService.getStatus().isMock) cached = readMock();
    return clone(cached ?? []);
  },
  refresh: refreshReminders,
  toggle: toggleReminder,
  syncSessions,
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
