import { useEffect, useMemo, useState } from "react";
import type { RadioScheduleReminder, RadioSession } from "../types/audio";
import { radioScheduleReminderService } from "../services/audio/radioScheduleReminderService";

export type RadioScheduleReminderHookState = Readonly<{
  reminders: readonly RadioScheduleReminder[];
  reminderIds: ReadonlySet<string>;
  loading: boolean;
  error: string | null;
  toggle: (session: RadioSession) => Promise<boolean>;
}>;

export function useRadioScheduleReminders(sessions: readonly RadioSession[]): RadioScheduleReminderHookState {
  const [reminders, setReminders] = useState(() => radioScheduleReminderService.getSnapshot());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scheduleKey = useMemo(() => sessions.map((session) => session.id + ":" + session.startsAt + ":" + session.status).sort().join("|"), [sessions]);

  useEffect(() => {
    let active = true;
    const unsubscribe = radioScheduleReminderService.subscribe((next) => {
      if (active) setReminders(next);
    });
    const sync = async () => {
      const refreshed = await radioScheduleReminderService.refresh();
      if (!active) return;
      setLoading(false);
      if (!refreshed.ok) {
        setError(refreshed.error);
        return;
      }
      const synchronized = await radioScheduleReminderService.syncSessions(sessions);
      if (active) setError(synchronized.ok ? null : synchronized.error);
    };
    void sync();
    const timer = window.setInterval(() => {
      void radioScheduleReminderService.syncSessions(sessions).then((result) => {
        if (active && !result.ok) setError(result.error);
      });
    }, 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
      unsubscribe();
    };
  }, [scheduleKey, sessions]);

  const reminderIds = useMemo(() => new Set(reminders.filter((item) => item.lastKnownStatus === "scheduled" || item.lastKnownStatus === "live").map((item) => item.radioSessionId)), [reminders]);

  return {
    reminders,
    reminderIds,
    loading,
    error,
    async toggle(session) {
      const result = await radioScheduleReminderService.toggle(session);
      setError(result.ok ? null : result.error);
      return result.ok ? result.data : reminderIds.has(session.id);
    },
  };
}
