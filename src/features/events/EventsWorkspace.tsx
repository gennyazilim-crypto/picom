import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { Community } from "../../types/community";
import type { CreateEventInput, EventListFilter, EventRsvpStatus, UpcomingEvent, UpcomingEventType } from "../../types/events";
import { bookmarkService } from "../../services/bookmarkService";
import { eventReminderService } from "../../services/eventReminderService";
import { eventService, type EventComment } from "../../services/eventService";
import { downloadIcsFile, googleCalendarUrl, outlookCalendarUrl } from "./utils/eventIcs";
import { AppIcon } from "../../components/AppIcon";
import "./EventsWorkspace.css";

type WorkspaceMode = "list" | "calendar";
type CalendarMode = "month" | "week" | "day" | "agenda";

const FILTERS: ReadonlyArray<{ id: EventListFilter; label: string }> = [
  { id: "discover", label: "Discover" },
  { id: "upcoming", label: "Upcoming" },
  { id: "going", label: "Going" },
  { id: "invites", label: "Invites" },
  { id: "created", label: "Created" },
  { id: "past", label: "Past" },
];

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

function countdownLabel(startsAt: string): string {
  const diff = Date.parse(startsAt) - Date.now();
  if (diff <= 0) return "Starting now";
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `In ${days}d ${hours % 24}h`;
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  return hours > 0 ? `In ${hours}h ${minutes}m` : `In ${minutes}m`;
}

function statusBadge(event: UpcomingEvent): string {
  if (event.cancelledAt || event.status === "cancelled") return "Cancelled";
  if (event.status === "live") return "Live";
  if (event.status === "completed" || Date.parse(event.endsAt ?? event.startsAt) < Date.now()) return "Ended";
  if (event.inviteStatus === "pending") return "Invited";
  if (event.currentUserRsvp === "waitlisted") return "Waitlist";
  if (event.capacity != null && (event.attendeeCount ?? 0) >= event.capacity) return "Full";
  return eventTypeLabel(event.type);
}

function eventTypeLabel(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function toLocalInput(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function emptyStateCopy(filter: EventListFilter): Readonly<{ title: string; body: string; showCreate: boolean }> {
  switch (filter) {
    case "going":
      return { title: "No RSVPs yet", body: "Events you mark as going will show up here.", showCreate: false };
    case "invites":
      return { title: "No invitations", body: "When someone invites you to an event, it will appear in this list.", showCreate: false };
    case "created":
      return { title: "Nothing created yet", body: "Publish your first event and manage it from this view.", showCreate: true };
    case "past":
      return { title: "No past events", body: "Completed and ended events will collect here after they finish.", showCreate: false };
    case "upcoming":
      return { title: "No upcoming events", body: "Create something for your community, or check Discover for public sessions.", showCreate: true };
    default:
      return { title: "No events to show", body: "Create an event or refine your filters to find sessions that match.", showCreate: true };
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

  const emptyCopy = emptyStateCopy(filter);
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
              <p className="events-workspace__eyebrow">Schedule</p>
              <h1 id="events-workspace-title">Events</h1>
            </div>
          </div>
          <p className="events-workspace__lede">Discover sessions, RSVP, invite people, and manage reminders in one workspace.</p>
        </div>
        <div className="events-workspace__actions">
          <div className="events-workspace__mode-toggle" role="group" aria-label="Events view mode">
            <button type="button" className={mode === "list" ? "active" : ""} onClick={() => setMode("list")} aria-pressed={mode === "list"}>List</button>
            <button type="button" className={mode === "calendar" ? "active" : ""} onClick={() => setMode("calendar")} aria-pressed={mode === "calendar"}>Calendar</button>
          </div>
          <button type="button" className="events-workspace__primary" onClick={() => setWizardOpen(true)}>
            <AppIcon name="plus" size="sm" />
            <span>Create event</span>
          </button>
        </div>
      </header>

      <div className="events-workspace__toolbar">
        <nav className="events-workspace__filters" aria-label="Event filters">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={filter === item.id ? "active" : ""}
              aria-pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <label className="events-workspace__search">
          <AppIcon name="search" size="sm" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search events" aria-label="Search events" />
        </label>
      </div>

      <div className="events-workspace__body">
        <section className="events-workspace__main" aria-label="Event results">
          {mode === "list" && featured.length > 0 && filter === "discover" ? (
            <div className="events-workspace__featured">
              {featured.slice(0, 1).map((event) => (
                <article key={event.id} className="events-featured-card">
                  {event.coverImage ? <img src={event.coverImage} alt="" className="events-featured-card__cover" /> : <div className="events-featured-card__cover events-featured-card__cover--empty" />}
                  <div className="events-featured-card__body">
                    <span className="events-badge">{statusBadge(event)}</span>
                    <h2>{event.title}</h2>
                    <p>{event.shortDescription || event.description || "No description yet."}</p>
                    <p className="events-featured-card__meta">{formatWhen(event.startsAt, event.scheduleTimezone)} · {countdownLabel(event.startsAt)}</p>
                    <button type="button" onClick={() => setSelectedId(event.id)}>Open details</button>
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
                    <span>Create event</span>
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
                      <span className="events-badge">{statusBadge(event)}</span>
                      <strong>{event.title}</strong>
                      <span>{formatWhen(event.startsAt, event.scheduleTimezone)}</span>
                      <span>{event.attendeeCount ?? 0} going{event.capacity != null ? ` / ${event.capacity}` : ""}</span>
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : (
            <div className="events-calendar">
              <div className="events-calendar__toolbar">
                <div className="events-calendar__nav">
                  <button type="button" className="events-calendar__nav-btn" aria-label="Previous period" onClick={() => shiftCalendar(-1)}>
                    <AppIcon name="chevronRight" size="sm" />
                  </button>
                  <h2 className="events-calendar__title">
                    {calendarMode === "day"
                      ? calendarCursor.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
                      : calendarCursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                  </h2>
                  <button type="button" className="events-calendar__nav-btn" aria-label="Next period" onClick={() => shiftCalendar(1)}>
                    <AppIcon name="chevronRight" size="sm" />
                  </button>
                  <button type="button" className="events-calendar__today" onClick={() => setCalendarCursor(new Date())}>Today</button>
                </div>
                <div className="events-workspace__mode-toggle" role="group" aria-label="Calendar density">
                  {([
                    { id: "month", label: "Month" },
                    { id: "week", label: "Week" },
                    { id: "day", label: "Day" },
                    { id: "agenda", label: "Agenda" },
                  ] as const).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={calendarMode === item.id ? "active" : ""}
                      aria-pressed={calendarMode === item.id}
                      onClick={() => setCalendarMode(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {calendarMode === "agenda" ? (
                visible.length === 0 ? (
                  <div className="events-calendar__agenda-empty" role="status">
                    <strong>No events in this view</strong>
                    <span>Switch filters or create an event to fill your agenda.</span>
                  </div>
                ) : (
                  <ul className="events-calendar__agenda">
                    {visible.map((event) => (
                      <li key={event.id}>
                        <button type="button" className={selected?.id === event.id ? "active" : ""} onClick={() => setSelectedId(event.id)}>
                          <span className="events-calendar__agenda-date">{formatWhen(event.startsAt, event.scheduleTimezone)}</span>
                          <strong>{event.title}</strong>
                          <span className="events-badge">{statusBadge(event)}</span>
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

        <aside className="events-workspace__detail" aria-label="Event details">
          {!selected ? (
            <div className="events-detail-empty" role="status">
              <span className="events-detail-empty__mark" aria-hidden="true"><AppIcon name="calendar" size="lg" /></span>
              <div className="events-detail-empty__copy">
                <strong>Event details</strong>
                <span>Select an event from the list to RSVP, invite people, set reminders, or export to your calendar.</span>
              </div>
              <ul className="events-detail-empty__hints">
                <li><AppIcon name="users" size="sm" /><span>RSVP & waitlist</span></li>
                <li><AppIcon name="send" size="sm" /><span>Email invites</span></li>
                <li><AppIcon name="bell" size="sm" /><span>Server reminders</span></li>
                <li><AppIcon name="pin" size="sm" /><span>ICS / Google / Outlook</span></li>
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
                  <span className="events-badge">{statusBadge(selected)}</span>
                  <p className="events-detail__countdown">{countdownLabel(selected.startsAt)}</p>
                </div>
                <h2>{selected.title}</h2>
                <p className="events-detail__meta">{formatWhen(selected.startsAt, selected.scheduleTimezone)}</p>
                <p className="events-detail__description">{selected.description || selected.shortDescription || "No description yet."}</p>
                {selected.communityId ? (
                  <button type="button" className="events-detail__community" onClick={() => onOpenCommunity(selected.communityId)}>
                    <AppIcon name="users" size="sm" />
                    Open community
                  </button>
                ) : null}

                <section className="events-detail__section" aria-label="RSVP">
                  <h3>Your RSVP</h3>
                  <div className="events-detail__rsvp" role="group">
                    {(["going", "interested", "maybe", "not_going"] as const).map((status) => (
                      <button key={status} type="button" disabled={busy} className={selected.currentUserRsvp === status ? "active" : ""} onClick={() => void updateRsvp(selected, status)}>
                        {status.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="events-detail__section" aria-label="Quick actions">
                  <h3>Actions</h3>
                  <div className="events-detail__tools">
                    <button type="button" disabled={busy} onClick={() => void toggleReminder(selected)}>{selected.reminderSet ? "Reminder on" : "Remind me"}</button>
                    <button type="button" disabled={busy} onClick={() => void toggleBookmark(selected)}>{savedEventIds.has(selected.id) ? "Saved" : "Save"}</button>
                    <button type="button" onClick={() => downloadIcsFile(selected, eventUrl(selected.id))}>Download .ics</button>
                    <a href={googleCalendarUrl(selected, eventUrl(selected.id))} target="_blank" rel="noreferrer">Google</a>
                    <a href={outlookCalendarUrl(selected, eventUrl(selected.id))} target="_blank" rel="noreferrer">Outlook</a>
                    <button type="button" onClick={() => onOpenEventSource(selected)}>Open source</button>
                  </div>
                </section>

                {(selected.createdBy === currentUserId) ? (
                  <section className="events-detail__section events-detail__manage" aria-label="Manage event">
                    <h3>Manage</h3>
                    <label>
                      Invite by email
                      <input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="friend@example.com" />
                    </label>
                    <button type="button" disabled={busy || !inviteEmail.trim()} onClick={() => void sendInvite()}>Send invite</button>
                    <label>
                      Cancel reason
                      <input value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Required to cancel" />
                    </label>
                    <button type="button" className="events-detail__danger" disabled={busy || cancelReason.trim().length < 3} onClick={() => void cancelSelected()}>Cancel event</button>
                  </section>
                ) : null}

                <section className="events-detail__section events-detail__comments" aria-label="Comments">
                  <h3>Comments</h3>
                  <ul>
                    {comments.length === 0 ? <li className="events-detail__comments-empty">No comments yet.</li> : null}
                    {comments.map((comment) => (
                      <li key={comment.id}><strong>{comment.userId.slice(0, 8)}</strong> {comment.content}</li>
                    ))}
                  </ul>
                  <form onSubmit={(event) => void submitComment(event)}>
                    <textarea value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="Add a comment" rows={3} />
                    <button type="submit" disabled={busy || !commentText.trim()}>Post</button>
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

  const steps = ["Basics", "Schedule", "Location", "Audience", "Capacity", "Details", "Cover", "Review"];

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
            <p className="events-workspace__eyebrow">Create</p>
            <h2 id="events-wizard-title">New event · {steps[step]}</h2>
          </div>
          <button type="button" className="icon-button" aria-label="Close create wizard" onClick={onClose}><AppIcon name="close" /></button>
        </header>
        <ol className="events-wizard__steps">
          {steps.map((label, index) => (
            <li key={label} className={index === step ? "active" : index < step ? "done" : ""}>{label}</li>
          ))}
        </ol>
        <div className="events-wizard__fields">
          {step === 0 ? (
            <>
              <label>Title<input required maxLength={120} value={draft.title} onChange={(event) => patch({ title: event.target.value })} /></label>
              <label>Short description<input maxLength={280} value={draft.shortDescription ?? ""} onChange={(event) => patch({ shortDescription: event.target.value })} /></label>
              <label>Type
                <select value={draft.eventType} onChange={(event) => patch({ eventType: event.target.value as UpcomingEventType })}>
                  {EVENT_TYPES.map((type) => <option key={type} value={type}>{eventTypeLabel(type)}</option>)}
                </select>
              </label>
            </>
          ) : null}
          {step === 1 ? (
            <>
              <label>Starts<input type="datetime-local" required value={toLocalInput(draft.startsAt)} onChange={(event) => patch({ startsAt: event.target.value })} /></label>
              <label>Ends<input type="datetime-local" value={toLocalInput(draft.endsAt)} onChange={(event) => patch({ endsAt: event.target.value })} /></label>
              <label>Timezone<input value={draft.timezone ?? ""} onChange={(event) => patch({ timezone: event.target.value })} /></label>
              <label className="events-wizard__check"><input type="checkbox" checked={Boolean(draft.isAllDay)} onChange={(event) => patch({ isAllDay: event.target.checked })} /> All day</label>
            </>
          ) : null}
          {step === 2 ? (
            <>
              <label>Location type
                <select value={draft.locationType ?? "none"} onChange={(event) => patch({ locationType: event.target.value as CreateEventInput["locationType"] })}>
                  <option value="none">None</option>
                  <option value="community">Community</option>
                  <option value="voice_room">Voice room</option>
                  <option value="video_room">Video room</option>
                  <option value="external">External link</option>
                  <option value="physical">Physical</option>
                </select>
              </label>
              <label>External meeting URL<input value={draft.externalMeetingUrl ?? ""} onChange={(event) => patch({ externalMeetingUrl: event.target.value || undefined })} placeholder="https://" /></label>
            </>
          ) : null}
          {step === 3 ? (
            <>
              <label>Visibility
                <select value={draft.visibility ?? "public"} onChange={(event) => patch({ visibility: event.target.value as CreateEventInput["visibility"] })}>
                  <option value="public">Public</option>
                  <option value="followers">Followers</option>
                  <option value="community_only">Community only</option>
                  <option value="private">Private</option>
                  <option value="secret">Secret</option>
                </select>
              </label>
              <label>Community
                <select value={draft.communityId ?? ""} onChange={(event) => patch({ communityId: event.target.value || undefined })}>
                  <option value="">Personal / global</option>
                  {communities.map((community) => <option key={community.id} value={community.id}>{community.name}</option>)}
                </select>
              </label>
            </>
          ) : null}
          {step === 4 ? (
            <>
              <label>Capacity<input type="number" min={1} value={draft.capacity ?? ""} onChange={(event) => patch({ capacity: event.target.value ? Number(event.target.value) : undefined })} placeholder="Unlimited" /></label>
              <label className="events-wizard__check"><input type="checkbox" checked={Boolean(draft.approvalRequired)} onChange={(event) => patch({ approvalRequired: event.target.checked })} /> Require approval</label>
            </>
          ) : null}
          {step === 5 ? (
            <>
              <label>Description<textarea rows={5} maxLength={5000} value={draft.description ?? ""} onChange={(event) => patch({ description: event.target.value })} /></label>
              <label>Rules<textarea rows={3} value={draft.rules ?? ""} onChange={(event) => patch({ rules: event.target.value || undefined })} /></label>
              <label>Language<input value={draft.language ?? ""} onChange={(event) => patch({ language: event.target.value || undefined })} /></label>
            </>
          ) : null}
          {step === 6 ? (
            <label>Cover image URL<input value={draft.coverImage ?? ""} onChange={(event) => patch({ coverImage: event.target.value || undefined })} placeholder="https://..." /></label>
          ) : null}
          {step === 7 ? (
            <div className="events-wizard__review">
              <p><strong>{draft.title || "Untitled"}</strong></p>
              <p>{draft.shortDescription || draft.description || "No description"}</p>
              <p>{draft.startsAt} → {draft.endsAt || "open end"}</p>
              <p>{eventTypeLabel(draft.eventType ?? "general")} · {draft.visibility}</p>
            </div>
          ) : null}
          {error ? <p className="events-wizard__error" role="alert">{error}</p> : null}
        </div>
        <footer>
          <button type="button" disabled={busy || step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))}>Back</button>
          {step < steps.length - 1 ? (
            <button type="submit" disabled={busy || (step === 0 && !draft.title.trim())}>Continue</button>
          ) : (
            <>
              <button type="button" disabled={busy} onClick={() => void submit(false)}>Save draft</button>
              <button type="submit" disabled={busy}>Publish</button>
            </>
          )}
        </footer>
      </form>
    </div>
  );
}
