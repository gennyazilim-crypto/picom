import { useMemo } from "react";
import type { RadioSession } from "../../types/audio";
import { dateTimeService } from "../../services/dateTimeService";
import { AppIcon } from "../AppIcon";
import "./RadioScheduleCalendarLite.css";

type RadioScheduleCalendarLiteProps = {
  sessions: readonly RadioSession[];
  timeZone: string;
  reminderIds: ReadonlySet<string>;
  getUserLabel: (userId: string) => string;
  onPreview: (session: RadioSession) => void;
  onToggleReminder: (sessionId: string) => void;
  reminderError?: string | null;
};

export function RadioScheduleCalendarLite({ sessions, timeZone, reminderIds, getUserLabel, onPreview, onToggleReminder, reminderError }: RadioScheduleCalendarLiteProps) {
  const dayGroups = useMemo(() => {
    const groups = new Map<string, RadioSession[]>();
    [...sessions].sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt)).forEach((session) => {
      const key = dateTimeService.getCalendarDayKey(session.startsAt, { timeZone });
      groups.set(key, [...(groups.get(key) ?? []), session]);
    });
    return [...groups.entries()];
  }, [sessions, timeZone]);

  return <div className="radio-schedule-calendar" aria-label={"Radio schedule in " + timeZone}>
    <header className="radio-schedule-calendar__summary"><span><AppIcon name="bell" size="sm" />{sessions.length} upcoming</span><small>Times shown in {timeZone}</small></header>
    {reminderError ? <div className="radio-schedule-calendar__error" role="status">{reminderError}</div> : null}
    <div className="radio-schedule-calendar__days">
      {dayGroups.map(([dayKey, daySessions]) => <section className="radio-schedule-day" key={dayKey}>
        <header><strong>{dateTimeService.formatEventDay(daySessions[0]?.startsAt, { timeZone })}</strong><span>{daySessions.length} {daySessions.length === 1 ? "show" : "shows"}</span></header>
        <div>{daySessions.map((session) => {
          const reminderSet = reminderIds.has(session.id);
          return <article className="radio-schedule-row" key={session.id}>
            <time dateTime={session.startsAt}>{dateTimeService.formatEventTime(session.startsAt, { timeZone })}</time>
            <span className="radio-schedule-row__copy"><strong>{session.title}</strong><small>{getUserLabel(session.hostUserId)} · {session.description}</small></span>
            <span className="radio-schedule-row__actions">
              <button type="button" className={reminderSet ? "active" : ""} aria-pressed={reminderSet} onClick={() => onToggleReminder(session.id)}><AppIcon name="bell" size="sm" />{reminderSet ? "Reminder set" : "Remind me"}</button>
              <button type="button" onClick={() => onPreview(session)}>Preview</button>
            </span>
          </article>;
        })}</div>
      </section>)}
    </div>
  </div>;
}
