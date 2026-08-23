import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { Community } from "../../types/community";
import type { CreateEventInput, EventListFilter, EventRsvpStatus, UpcomingEvent, UpcomingEventType } from "../../types/events";
import { bookmarkService } from "../../services/bookmarkService";
import { eventReminderService } from "../../services/eventReminderService";
import { eventService, type EventComment } from "../../services/eventService";
import { downloadIcsFile, googleCalendarUrl, outlookCalendarUrl } from "./utils/eventIcs";
import { AppIcon } from "../../components/AppIcon";
import { useTranslation } from "../../i18n";
import type { TFunction } from "../../i18n";
import "./EventsWorkspace.css";

type WorkspaceMode = "list" | "calendar";
type CalendarMode = "month" | "week" | "day" | "agenda";

/** Filter ids double as translation keys (`filter.<id>`), so the order stays data-driven. */
const FILTERS: ReadonlyArray<EventListFilter> = ["discover", "upcoming", "going", "invites", "created", "past"];

const WIZARD_STEP_IDS = ["basics", "schedule", "location", "audience", "capacity", "details", "cover", "review"] as const;

const EVENT_TYPES: ReadonlyArray<UpcomingEventType> = [
  "general", "workshop", "conference", "tournament", "livestream", "video", "physical", "invite_only", "community_event", "meeting", "social",
];

function formatWhen(value: string, timezone?: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone || undefined,
  }).format(new Date(value));
}

function countdownLabel(t: TFunction, startsAt: string): string {
  const diff = Date.parse(startsAt) - Date.now();
  if (diff <= 0) return t("countdown.startingNow");
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(hours / 24);
  if (days > 0) return t("countdown.days", { days, hours: hours % 24 });
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  return hours > 0 ? t("countdown.hours", { hours, minutes }) : t("countdown.minutes", { minutes });
}

function statusBadge(t: TFunction, event: UpcomingEvent): string {
  if (event.cancelledAt || event.status === "cancelled") return t("status.cancelled");
  if (event.status === "live") return t("status.live");
  if (event.status === "completed" || Date.parse(event.endsAt ?? event.startsAt) < Date.now()) return t("status.ended");
  if (event.inviteStatus === "pending") return t("status.invited");
  if (event.currentUserRsvp === "waitlisted") return t("status.waitlist");
  if (event.capacity != null && (event.attendeeCount ?? 0) >= event.capacity) return t("status.full");
  return eventTypeLabel(t, event.type);
}

/** Event type codes are stored raw ("invite_only"); `type.<code>` keys carry the display copy. */
function eventTypeLabel(t: TFunction, type: string): string {
  return t(`type.${type}`);
}

function toLocalInput(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function emptyStateCopy(t: TFunction, filter: EventListFilter): Readonly<{ title: string; body: string; showCreate: boolean }> {
  const forFilter = (key: string, showCreate: boolean) => ({
    title: t(`empty.${key}.title`),
    body: t(`empty.${key}.body`),
    showCreate,
  });
  switch (filter) {
    case "going":
      return forFilter("going", false);
    case "invites":
      return forFilter("invites", false);
    case "created":
      return forFilter("created", true);
    case "past":
      return forFilter("past", false);
    case "upcoming":
      return forFilter("upcoming", true);
    default:
      return forFilter("default", true);
  }
}

function eventUrl(eventId: string): string {
  return `https://app.picom.gg/events/${eventId}`;
}

function startOfWeek(date: Date): Date {
  const next = new Date(date);
  const day = next.getDay();
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() - day);
  return next;
}

export function EventsWorkspace({
  events,
  communities,
  currentUserId,
  onOpenCommunity,
  onOpenEventSource,
  onEventChange,
  onRefresh,
  initialEventId = null,
  initialCreateOpen = false,
}: {
  events: readonly UpcomingEvent[];
  communities: readonly Community[];
  currentUserId: string;
  onOpenCommunity: (communityId: string) => void;
  onOpenEventSource: (event: UpcomingEvent) => void;
  onEventChange: (event: UpcomingEvent) => void;
  onRefresh: () => void;
  initialEventId?: string | null;
  initialCreateOpen?: boolean;
}) {
  const [filter, setFilter] = useState<EventListFilter>("discover");
  const { t } = useTranslation("events");
  const [mode, setMode] = useState<WorkspaceMode>("list");
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("month");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [remoteEvents, setRemoteEvents] = useState<UpcomingEvent[] | null>(null);
  const [featured, setFeatured] = useState<UpcomingEvent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialEventId);
  const [comments, setComments] = useState<EventComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [busy, setBusy] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(initialCreateOpen);
  const [inviteEmail, setInviteEmail] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [savedEventIds, setSavedEventIds] = useState<Set<string>>(new Set());
  const [calendarCursor, setCalendarCursor] = useState(() => new Date());
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    void bookmarkService.listBookmarks().then((items) => {
      setSavedEventIds(new Set(items.filter((item) => item.contentType === "event").map((item) => item.contentId)));
    });
    void eventService.listFeatured(6).then(setFeatured).catch(() => setFeatured([]));
  }, []);

  useEffect(() => {
    if (initialEventId) setSelectedId(initialEventId);
  }, [initialEventId]);

  useEffect(() => {
    if (initialCreateOpen) setWizardOpen(true);
  }, [initialCreateOpen]);

  useEffect(() => {
    if (!initialEventId) return;
    let active = true;
    void eventService.getEvent(initialEventId).then((event) => {
      if (!active || !event) return;
      onEventChange(event);
      setSelectedId(event.id);
    });
    return () => { active = false; };
  }, [initialEventId, onEventChange]);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    void eventService
      .listEvents({ filter, search: debouncedQuery || undefined, limit: 80 })
      .then((items) => {
        if (!controller.signal.aborted) setRemoteEvents(items);
      })
      .catch(() => {
        if (!controller.signal.aborted) setRemoteEvents(null);
      });
    return () => controller.abort();
  }, [debouncedQuery, filter]);

  const sourceEvents = remoteEvents ?? events;
  const visible = useMemo(() => {
    const now = Date.now();
    return [...sourceEvents]
      .filter((event) => {
        if (filter === "past") return Boolean(event.cancelledAt) || Date.parse(event.endsAt ?? event.startsAt) < now;
        return !event.cancelledAt && event.status !== "cancelled";
      })
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }, [filter, sourceEvents]);

  const selected = visible.find((event) => event.id === selectedId) ?? visible[0] ?? null;

  useEffect(() => {
    if (!selected) { setComments([]); return; }
    let active = true;
    void eventService.listComments(selected.id).then((items) => { if (active) setComments(items); });
    return () => { active = false; };
  }, [selected?.id]);

  const updateRsvp = async (event: UpcomingEvent, status: EventRsvpStatus) => {
    setBusy(true);
    const result = await eventService.setRsvp(event.id, status);
    if (result) {
      onEventChange({
        ...event,
        currentUserRsvp: result.status,
        waitlistPosition: result.waitlistPosition ?? undefined,
        attendeeCount: Math.max(0, (event.attendeeCount ?? 0) + (result.status === "going" && event.currentUserRsvp !== "going" ? 1 : result.status !== "going" && event.currentUserRsvp === "going" ? -1 : 0)),
      });
      onRefresh();
    }
    setBusy(false);
  };

  const toggleReminder = async (event: UpcomingEvent) => {
    const enabled = !event.reminderSet;
    setBusy(true);
    if (await eventReminderService.set(event, enabled, event.currentUserRsvp)) {
      onEventChange({ ...event, reminderSet: enabled });
    }
    setBusy(false);
  };

  const toggleBookmark = async (event: UpcomingEvent) => {
    setBusy(true);
    const isSaved = savedEventIds.has(event.id);
    const result = isSaved
      ? await bookmarkService.deleteBookmarkByTarget("event", event.id)
      : await bookmarkService.saveBookmark({
          contentType: "event",
          contentId: event.id,
          metadata: { title: event.title, preview: event.description, communityId: event.communityId || undefined, startsAt: event.startsAt, imageUrl: event.coverImage },
        });
    if (result) {
      setSavedEventIds((current) => {
        const next = new Set(current);
        if (isSaved) next.delete(event.id);
        else next.add(event.id);
        return next;
      });
    }
    setBusy(false);
  };

  const submitComment = async (formEvent: FormEvent) => {
    formEvent.preventDefault();
    if (!selected || !commentText.trim()) return;
    setBusy(true);
    const added = await eventService.addComment(selected.id, commentText);
    if (added) {
      setComments((current) => [...current, added]);
      setCommentText("");
    }
    setBusy(false);
  };

  const sendInvite = async () => {
    if (!selected || !inviteEmail.trim()) return;
    setBusy(true);
    const token = crypto.randomUUID().replace(/-/g, "");
    const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
    const tokenHash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
    await eventService.inviteEmail(selected.id, inviteEmail, tokenHash);
    setInviteEmail("");
    setBusy(false);
  };

  const cancelSelected = async () => {
    if (!selected || cancelReason.trim().length < 3) return;
    setBusy(true);
    const updated = await eventService.cancelEvent(selected.id, cancelReason.trim());
    if (updated) {
      onEventChange(updated);
      setCancelReason("");
      onRefresh();
    }
    setBusy(false);
  };

  const calendarDays = useMemo(() => {
    if (calendarMode === "day") return [new Date(calendarCursor)];
    if (calendarMode === "week") {
      const start = startOfWeek(calendarCursor);
      return Array.from({ length: 7 }, (_, index) => {
        const day = new Date(start);
        day.setDate(start.getDate() + index);
        return day;
      });
    }
    const first = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), 1);
    const start = startOfWeek(first);
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  }, [calendarCursor, calendarMode]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, UpcomingEvent[]>();
    for (const event of visible) {
      const key = new Date(event.startsAt).toDateString();
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    return map;
  }, [visible]);

  const emptyCopy = emptyStateCopy(t, filter);
  const todayKey = new Date().toDateString();
  const weekdayLabels = useMemo(
    () => Array.from({ length: 7 }, (_, index) => {
      const day = startOfWeek(new Date());
      day.setDate(day.getDate() + index);
      return day.toLocaleDateString(undefined, { weekday: "short" });
    }),
    [],
  );

  const shiftCalendar = (direction: -1 | 1) => {
    setCalendarCursor((current) => {
      const next = new Date(current);
      if (calendarMode === "month") next.setMonth(next.getMonth() + direction);
      else if (calendarMode === "week") next.setDate(next.getDate() + direction * 7);
      else next.setDate(next.getDate() + direction);
      return next;
    });
  };

  return (
    <main className="events-workspace events-workspace--chrome" aria-labelledby="events-workspace-title">
      <header className="events-workspace__header">
        <div className="events-workspace__intro">
          <div className="events-workspace__title-row">
            <span className="events-workspace__mark" aria-hidden="true"><AppIcon name="calendar" size="lg" /></span>
            <div className="events-workspace__titles">
              <p className="events-workspace__eyebrow">{t("header.eyebrow")}</p>
              <h1 id="events-workspace-title">{t("header.title")}</h1>
            </div>
          </div>
          <p className="events-workspace__lede">{t("header.lede")}</p>
        </div>
        <div className="events-workspace__actions">
          <div className="events-workspace__mode-toggle" role="group" aria-label={t("mode.aria")}>
            <button type="button" className={mode === "list" ? "active" : ""} onClick={() => setMode("list")} aria-pressed={mode === "list"}>{t("mode.list")}</button>
            <button type="button" className={mode === "calendar" ? "active" : ""} onClick={() => setMode("calendar")} aria-pressed={mode === "calendar"}>{t("mode.calendar")}</button>
          </div>
          <button type="button" className="events-workspace__primary" onClick={() => setWizardOpen(true)}>
            <AppIcon name="plus" size="sm" />
            <span>{t("action.createEvent")}</span>
          </button>
        </div>
      </header>

      <div className="events-workspace__toolbar">
        <nav className="events-workspace__filters" aria-label={t("filter.aria")}>
          {FILTERS.map((id) => (
            <button
              key={id}
              type="button"
              className={filter === id ? "active" : ""}
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
            >
              {t(`filter.${id}`)}
            </button>
          ))}
        </nav>
        <label className="events-workspace__search">
          <AppIcon name="search" size="sm" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("search.placeholder")} aria-label={t("search.aria")} />
        </label>
      </div>

      <div className="events-workspace__body">
        <section className="events-workspace__main" aria-label={t("results.aria")}>
          {mode === "list" && featured.length > 0 && filter === "discover" ? (
            <div className="events-workspace__featured">
              {featured.slice(0, 1).map((event) => (
                <article key={event.id} className="events-featured-card">
                  {event.coverImage ? <img src={event.coverImage} alt="" className="events-featured-card__cover" /> : <div className="events-featured-card__cover events-featured-card__cover--empty" />}
                  <div className="events-featured-card__body">
                    <span className="events-badge">{statusBadge(t, event)}</span>
                    <h2>{event.title}</h2>
                    <p>{event.shortDescription || event.description || t("card.noDescription")}</p>
                    <p className="events-featured-card__meta">{formatWhen(event.startsAt, event.scheduleTimezone)} · {countdownLabel(t, event.startsAt)}</p>
                    <button type="button" onClick={() => setSelectedId(event.id)}>{t("card.openDetails")}</button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          {mode === "list" ? (
            visible.length === 0 ? (
              <div className="events-empty" role="status">
                <span className="events-empty__mark" aria-hidden="true"><AppIcon name="calendar" size="xl" /></span>
                <div className="events-empty__copy">
                  <strong>{emptyCopy.title}</strong>
                  <span>{emptyCopy.body}</span>
                </div>
                {emptyCopy.showCreate ? (
                  <button type="button" className="events-workspace__primary" onClick={() => setWizardOpen(true)}>
                    <AppIcon name="plus" size="sm" />
                    <span>{t("action.createEvent")}</span>
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="events-card-grid">
                {visible.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    className={`events-card ${selected?.id === event.id ? "active" : ""}`}
                    onClick={() => setSelectedId(event.id)}
                  >
                    {event.coverImage ? <img src={event.coverImage} alt="" /> : <div className="events-card__placeholder" />}
                    <div className="events-card__body">
                      <span className="events-badge">{statusBadge(t, event)}</span>
                      <strong>{event.title}</strong>
                      <span>{formatWhen(event.startsAt, event.scheduleTimezone)}</span>
                      <span>{event.capacity != null ? t("card.attendeesCapacity", { count: event.attendeeCount ?? 0, capacity: event.capacity }) : t("card.attendees", { count: event.attendeeCount ?? 0 })}</span>
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : (
            <div className="events-calendar">
              <div className="events-calendar__toolbar">
                <div className="events-calendar__nav">
                  <button type="button" className="events-calendar__nav-btn" aria-label={t("calendar.previousPeriod")} onClick={() => shiftCalendar(-1)}>
                    <AppIcon name="chevronRight" size="sm" />
                  </button>
                  <h2 className="events-calendar__title">
                    {calendarMode === "day"
                      ? calendarCursor.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
                      : calendarCursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                  </h2>
                  <button type="button" className="events-calendar__nav-btn" aria-label={t("calendar.nextPeriod")} onClick={() => shiftCalendar(1)}>
                    <AppIcon name="chevronRight" size="sm" />
                  </button>
                  <button type="button" className="events-calendar__today" onClick={() => setCalendarCursor(new Date())}>{t("calendar.today")}</button>
                </div>
                <div className="events-workspace__mode-toggle" role="group" aria-label={t("calendar.densityAria")}>
                  {(["month", "week", "day", "agenda"] as const).map((id) => (
                    <button
                      key={id}
                      type="button"
                      className={calendarMode === id ? "active" : ""}
                      aria-pressed={calendarMode === id}
                      onClick={() => setCalendarMode(id)}
                    >
                      {t(`calendar.${id}`)}
                    </button>
                  ))}
                </div>
              </div>

              {calendarMode === "agenda" ? (
                visible.length === 0 ? (
                  <div className="events-calendar__agenda-empty" role="status">
                    <strong>{t("calendar.agendaEmptyTitle")}</strong>
                    <span>{t("calendar.agendaEmptyBody")}</span>
                  </div>
                ) : (
                  <ul className="events-calendar__agenda">
                    {visible.map((event) => (
                      <li key={event.id}>
                        <button type="button" className={selected?.id === event.id ? "active" : ""} onClick={() => setSelectedId(event.id)}>
                          <span className="events-calendar__agenda-date">{formatWhen(event.startsAt, event.scheduleTimezone)}</span>
                          <strong>{event.title}</strong>
                          <span className="events-badge">{statusBadge(t, event)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )
              ) : (
                <div className={`events-calendar__board events-calendar__board--${calendarMode}`}>
                  {calendarMode !== "day" ? (
                    <div className="events-calendar__weekdays" aria-hidden="true">
                      {weekdayLabels.map((label, index) => (
                        <span key={`${label}-${index}`}>{label}</span>
                      ))}
                    </div>
                  ) : null}
                  <div className={`events-calendar__grid events-calendar__grid--${calendarMode}`}>
                    {calendarDays.map((day) => {
                      const key = day.toDateString();
                      const dayEvents = eventsByDay.get(key) ?? [];
                      const isOutsideMonth = calendarMode === "month" && day.getMonth() !== calendarCursor.getMonth();
                      const isToday = key === todayKey;
                      const extra = dayEvents.length - 3;
                      return (
                        <div
                          key={key}
                          className={[
                            "events-calendar__cell",
                            isOutsideMonth ? "is-outside" : "",
                            isToday ? "is-today" : "",
                            dayEvents.length > 0 ? "has-events" : "",
                          ].filter(Boolean).join(" ")}
                        >
                          <div className="events-calendar__dayhead">
                            <span className="events-calendar__daynum">{day.getDate()}</span>
                            {calendarMode === "day" ? (
                              <span className="events-calendar__daylabel">{day.toLocaleDateString(undefined, { weekday: "long" })}</span>
                            ) : null}
                          </div>
                          <div className="events-calendar__events">
                            {dayEvents.slice(0, 3).map((event) => (
                              <button
                                key={event.id}
                                type="button"
                                className={selected?.id === event.id ? "active" : ""}
                                title={event.title}
                                onClick={() => setSelectedId(event.id)}
                              >
                                {event.title}
                              </button>
                            ))}
                            {extra > 0 ? <span className="events-calendar__more">+{extra} more</span> : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <aside className="events-workspace__detail" aria-label={t("detail.aria")}>
          {!selected ? (
            <div className="events-detail-empty" role="status">
              <span className="events-detail-empty__mark" aria-hidden="true"><AppIcon name="calendar" size="lg" /></span>
              <div className="events-detail-empty__copy">
                <strong>{t("detail.emptyTitle")}</strong>
                <span>{t("detail.emptyBody")}</span>
              </div>
              <ul className="events-detail-empty__hints">
                <li><AppIcon name="users" size="sm" /><span>{t("detail.hint.rsvp")}</span></li>
                <li><AppIcon name="send" size="sm" /><span>{t("detail.hint.invites")}</span></li>
                <li><AppIcon name="bell" size="sm" /><span>{t("detail.hint.reminders")}</span></li>
                <li><AppIcon name="pin" size="sm" /><span>{t("detail.hint.calendar")}</span></li>
              </ul>
            </div>
          ) : (
            <div className="events-detail">
              {selected.coverImage ? (
                <img className="events-detail__cover" src={selected.coverImage} alt="" />
              ) : (
                <div className="events-detail__cover events-detail__cover--fallback" aria-hidden="true" />
              )}
              <div className="events-detail__body">
                <div className="events-detail__topline">
                  <span className="events-badge">{statusBadge(t, selected)}</span>
                  <p className="events-detail__countdown">{countdownLabel(t, selected.startsAt)}</p>
                </div>
                <h2>{selected.title}</h2>
                <p className="events-detail__meta">{formatWhen(selected.startsAt, selected.scheduleTimezone)}</p>
                <p className="events-detail__description">{selected.description || selected.shortDescription || t("card.noDescription")}</p>
                {selected.communityId ? (
                  <button type="button" className="events-detail__community" onClick={() => onOpenCommunity(selected.communityId)}>
                    <AppIcon name="users" size="sm" />
                    {t("detail.openCommunity")}
                  </button>
                ) : null}

                <section className="events-detail__section" aria-label={t("detail.rsvpAria")}>
                  <h3>{t("detail.yourRsvp")}</h3>
                  <div className="events-detail__rsvp" role="group">
                    {(["going", "interested", "maybe", "not_going"] as const).map((status) => (
                      <button key={status} type="button" disabled={busy} className={selected.currentUserRsvp === status ? "active" : ""} onClick={() => void updateRsvp(selected, status)}>
                        {t(`rsvp.${status}`)}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="events-detail__section" aria-label={t("detail.quickActionsAria")}>
                  <h3>{t("detail.actions")}</h3>
                  <div className="events-detail__tools">
                    <button type="button" disabled={busy} onClick={() => void toggleReminder(selected)}>{selected.reminderSet ? t("detail.reminderOn") : t("detail.remindMe")}</button>
                    <button type="button" disabled={busy} onClick={() => void toggleBookmark(selected)}>{savedEventIds.has(selected.id) ? t("detail.saved") : t("detail.save")}</button>
                    <button type="button" onClick={() => downloadIcsFile(selected, eventUrl(selected.id))}>{t("detail.downloadIcs")}</button>
                    <a href={googleCalendarUrl(selected, eventUrl(selected.id))} target="_blank" rel="noreferrer">{t("detail.google")}</a>
                    <a href={outlookCalendarUrl(selected, eventUrl(selected.id))} target="_blank" rel="noreferrer">{t("detail.outlook")}</a>
                    <button type="button" onClick={() => onOpenEventSource(selected)}>{t("detail.openSource")}</button>
                  </div>
                </section>

                {(selected.createdBy === currentUserId) ? (
                  <section className="events-detail__section events-detail__manage" aria-label={t("detail.manageAria")}>
                    <h3>{t("detail.manage")}</h3>
                    <label>
                      {t("detail.inviteByEmail")}
                      <input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder={t("detail.invitePlaceholder")} />
                    </label>
                    <button type="button" disabled={busy || !inviteEmail.trim()} onClick={() => void sendInvite()}>{t("detail.sendInvite")}</button>
                    <label>
                      {t("detail.cancelReason")}
                      <input value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder={t("detail.cancelPlaceholder")} />
                    </label>
                    <button type="button" className="events-detail__danger" disabled={busy || cancelReason.trim().length < 3} onClick={() => void cancelSelected()}>{t("detail.cancelEvent")}</button>
                  </section>
                ) : null}

                <section className="events-detail__section events-detail__comments" aria-label={t("detail.commentsAria")}>
                  <h3>{t("detail.comments")}</h3>
                  <ul>
                    {comments.length === 0 ? <li className="events-detail__comments-empty">{t("detail.noComments")}</li> : null}
                    {comments.map((comment) => (
                      <li key={comment.id}><strong>{comment.userId.slice(0, 8)}</strong> {comment.content}</li>
                    ))}
                  </ul>
                  <form onSubmit={(event) => void submitComment(event)}>
                    <textarea value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder={t("detail.addComment")} rows={3} />
                    <button type="submit" disabled={busy || !commentText.trim()}>{t("detail.post")}</button>
                  </form>
                </section>
              </div>
            </div>
          )}
        </aside>
      </div>

      {wizardOpen ? (
        <EventCreateWizard
          communities={communities}
          onClose={() => setWizardOpen(false)}
          onCreated={(event) => {
            onEventChange(event);
            setSelectedId(event.id);
            setWizardOpen(false);
            onRefresh();
          }}
        />
      ) : null}
    </main>
  );
}

function EventCreateWizard({
  communities,
  onClose,
  onCreated,
}: {
  communities: readonly Community[];
  onClose: () => void;
  onCreated: (event: UpcomingEvent) => void;
}) {
  const { t } = useTranslation("events");
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<CreateEventInput>({
    title: "",
    shortDescription: "",
    description: "",
    eventType: "general",
    category: "general",
    visibility: "public",
    status: "draft",
    startsAt: toLocalInput(new Date(Date.now() + 3_600_000).toISOString()),
    endsAt: toLocalInput(new Date(Date.now() + 7_200_000).toISOString()),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    locationType: "none",
    capacity: undefined,
    approvalRequired: false,
    chatEnabled: true,
    communityId: communities[0]?.id,
  });

  const steps = WIZARD_STEP_IDS.map((id) => t(`wizard.step.${id}`));

  const patch = useCallback((partial: Partial<CreateEventInput>) => {
    setDraft((current) => ({ ...current, ...partial }));
  }, []);

  const submit = async (publish: boolean) => {
    setBusy(true);
    setError(null);
    const payload: CreateEventInput = {
      ...draft,
      startsAt: new Date(draft.startsAt).toISOString(),
      endsAt: draft.endsAt ? new Date(draft.endsAt).toISOString() : undefined,
      status: publish ? "published" : "draft",
    };
    const result = await eventService.createEvent(payload);
    if (!result.ok) {
      setError(result.issues.map((issue) => issue.message).join(" "));
      setBusy(false);
      return;
    }
    let event = result.event;
    if (publish && event.status === "draft") {
      event = (await eventService.publishEvent(event.id)) ?? event;
    }
    onCreated(event);
    setBusy(false);
  };

  return (
    <div className="modal-backdrop events-wizard-backdrop" onMouseDown={onClose}>
      <form
        className="events-wizard"
        role="dialog"
        aria-modal="true"
        aria-labelledby="events-wizard-title"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          if (step < steps.length - 1) setStep((current) => current + 1);
          else void submit(true);
        }}
      >
        <header>
          <div>
            <p className="events-workspace__eyebrow">{t("wizard.eyebrow")}</p>
            <h2 id="events-wizard-title">{t("wizard.title", { step: steps[step] })}</h2>
          </div>
          <button type="button" className="icon-button" aria-label={t("wizard.close")} onClick={onClose}><AppIcon name="close" /></button>
        </header>
        <ol className="events-wizard__steps">
          {steps.map((label, index) => (
            <li key={label} className={index === step ? "active" : index < step ? "done" : ""}>{label}</li>
          ))}
        </ol>
        <div className="events-wizard__fields">
          {step === 0 ? (
            <>
              <label>{t("field.title")}<input required maxLength={120} value={draft.title} onChange={(event) => patch({ title: event.target.value })} /></label>
              <label>{t("field.shortDescription")}<input maxLength={280} value={draft.shortDescription ?? ""} onChange={(event) => patch({ shortDescription: event.target.value })} /></label>
              <label>{t("field.type")}
                <select value={draft.eventType} onChange={(event) => patch({ eventType: event.target.value as UpcomingEventType })}>
                  {EVENT_TYPES.map((type) => <option key={type} value={type}>{eventTypeLabel(t, type)}</option>)}
                </select>
              </label>
            </>
          ) : null}
          {step === 1 ? (
            <>
              <label>{t("field.starts")}<input type="datetime-local" required value={toLocalInput(draft.startsAt)} onChange={(event) => patch({ startsAt: event.target.value })} /></label>
              <label>{t("field.ends")}<input type="datetime-local" value={toLocalInput(draft.endsAt)} onChange={(event) => patch({ endsAt: event.target.value })} /></label>
              <label>{t("field.timezone")}<input value={draft.timezone ?? ""} onChange={(event) => patch({ timezone: event.target.value })} /></label>
              <label className="events-wizard__check"><input type="checkbox" checked={Boolean(draft.isAllDay)} onChange={(event) => patch({ isAllDay: event.target.checked })} /> {t("field.allDay")}</label>
            </>
          ) : null}
          {step === 2 ? (
            <>
              <label>{t("field.locationType")}
                <select value={draft.locationType ?? "none"} onChange={(event) => patch({ locationType: event.target.value as CreateEventInput["locationType"] })}>
                  <option value="none">{t("location.none")}</option>
                  <option value="community">{t("location.community")}</option>
                  <option value="voice_room">{t("location.voiceRoom")}</option>
                  <option value="video_room">{t("location.videoRoom")}</option>
                  <option value="external">{t("location.external")}</option>
                  <option value="physical">{t("location.physical")}</option>
                </select>
              </label>
              <label>{t("field.externalUrl")}<input value={draft.externalMeetingUrl ?? ""} onChange={(event) => patch({ externalMeetingUrl: event.target.value || undefined })} placeholder="https://" /></label>
            </>
          ) : null}
          {step === 3 ? (
            <>
              <label>{t("field.visibility")}
                <select value={draft.visibility ?? "public"} onChange={(event) => patch({ visibility: event.target.value as CreateEventInput["visibility"] })}>
                  <option value="public">{t("visibility.public")}</option>
                  <option value="followers">{t("visibility.followers")}</option>
                  <option value="community_only">{t("visibility.communityOnly")}</option>
                  <option value="private">{t("visibility.private")}</option>
                  <option value="secret">{t("visibility.secret")}</option>
                </select>
              </label>
              <label>{t("field.community")}
                <select value={draft.communityId ?? ""} onChange={(event) => patch({ communityId: event.target.value || undefined })}>
                  <option value="">{t("community.personal")}</option>
                  {communities.map((community) => <option key={community.id} value={community.id}>{community.name}</option>)}
                </select>
              </label>
            </>
          ) : null}
          {step === 4 ? (
            <>
              <label>{t("field.capacity")}<input type="number" min={1} value={draft.capacity ?? ""} onChange={(event) => patch({ capacity: event.target.value ? Number(event.target.value) : undefined })} placeholder={t("field.capacityPlaceholder")} /></label>
              <label className="events-wizard__check"><input type="checkbox" checked={Boolean(draft.approvalRequired)} onChange={(event) => patch({ approvalRequired: event.target.checked })} /> {t("field.requireApproval")}</label>
            </>
          ) : null}
          {step === 5 ? (
            <>
              <label>{t("field.description")}<textarea rows={5} maxLength={5000} value={draft.description ?? ""} onChange={(event) => patch({ description: event.target.value })} /></label>
              <label>{t("field.rules")}<textarea rows={3} value={draft.rules ?? ""} onChange={(event) => patch({ rules: event.target.value || undefined })} /></label>
              <label>{t("field.language")}<input value={draft.language ?? ""} onChange={(event) => patch({ language: event.target.value || undefined })} /></label>
            </>
          ) : null}
          {step === 6 ? (
            <label>{t("field.coverImage")}<input value={draft.coverImage ?? ""} onChange={(event) => patch({ coverImage: event.target.value || undefined })} placeholder="https://..." /></label>
          ) : null}
          {step === 7 ? (
            <div className="events-wizard__review">
              <p><strong>{draft.title || t("review.untitled")}</strong></p>
              <p>{draft.shortDescription || draft.description || t("review.noDescription")}</p>
              <p>{draft.startsAt} → {draft.endsAt || t("review.openEnd")}</p>
              <p>{eventTypeLabel(t, draft.eventType ?? "general")} · {draft.visibility}</p>
            </div>
          ) : null}
          {error ? <p className="events-wizard__error" role="alert">{error}</p> : null}
        </div>
        <footer>
          <button type="button" disabled={busy || step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))}>{t("wizard.back")}</button>
          {step < steps.length - 1 ? (
            <button type="submit" disabled={busy || (step === 0 && !draft.title.trim())}>{t("wizard.continue")}</button>
          ) : (
            <>
              <button type="button" disabled={busy} onClick={() => void submit(false)}>{t("wizard.saveDraft")}</button>
              <button type="submit" disabled={busy}>{t("wizard.publish")}</button>
            </>
          )}
        </footer>
      </form>
    </div>
  );
}
