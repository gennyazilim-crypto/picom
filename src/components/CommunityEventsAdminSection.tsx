import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Community } from "../types/community";
import type { CreateCommunityEventInput, UpdateCommunityEventInput } from "../services/communityEventService";
import { communityEventService } from "../services/communityEventService";
import { eventReminderService } from "../services/eventReminderService";
import type { EventRsvpStatus, UpcomingEvent, UpcomingEventType } from "../types/events";
import { dateTimeService } from "../services/dateTimeService";
import { AppIcon } from "./AppIcon";
import "./CommunityEventsAdminSection.css";

const rsvpOptions: readonly EventRsvpStatus[] = ["interested", "going", "not_going"];

function toLocalDateTime(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function rsvpLabel(status: EventRsvpStatus): string {
  if (status === "not_going") return "Not going";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function eventTypeLabel(type: UpcomingEventType): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export function EventEditorModal({
  community,
  initial,
  onClose,
  onSave,
}: {
  community: Community;
  initial?: UpcomingEvent;
  onClose: () => void;
  onSave: (input: CreateCommunityEventInput | UpdateCommunityEventInput) => void | Promise<void>;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [startsAt, setStartsAt] = useState(toLocalDateTime(initial?.startsAt));
  const [endsAt, setEndsAt] = useState(toLocalDateTime(initial?.endsAt));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !startsAt) return;
    const input = {
      ...(initial ? {} : { communityId: community.id }),
      channelId: initial?.channelId,
      title,
      description,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
      type: initial?.type ?? ("meeting" as const),
    };
    await onSave(input);
    onClose();
  };

  return (
    <div className="modal-backdrop community-events-editor-backdrop" onMouseDown={onClose}>
      <form
        className="community-events-editor-dialog"
        onSubmit={(event) => void submit(event)}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="community-events-editor-title"
      >
        <header className="community-events-editor-header">
          <div>
            <p className="eyebrow">Community event</p>
            <h2 id="community-events-editor-title">{initial ? "Edit event" : "Create event"}</h2>
          </div>
          <button type="button" className="community-mgmt-action community-mgmt-action--ghost community-mgmt-action--icon" aria-label="Close" onClick={onClose}>
            <AppIcon name="close" size="sm" />
          </button>
        </header>

        <div className="community-events-editor-body">
          <label className="community-mgmt-field">
            <span>Title</span>
            <input
              className="community-mgmt-input"
              value={title}
              maxLength={120}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>

          <label className="community-mgmt-field">
            <span>Description</span>
            <textarea
              className="community-mgmt-textarea"
              value={description}
              maxLength={2000}
              rows={4}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>

          <div className="community-events-time-grid">
            <label className="community-mgmt-field">
              <span>Starts</span>
              <input
                className="community-mgmt-input"
                type="datetime-local"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
              />
            </label>
            <label className="community-mgmt-field">
              <span>Ends (optional)</span>
              <input
                className="community-mgmt-input"
                type="datetime-local"
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
              />
            </label>
          </div>
        </div>

        <footer className="community-mgmt-footer">
          <button type="button" className="community-mgmt-action community-mgmt-action--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="community-mgmt-action" disabled={!title.trim() || !startsAt}>
            {initial ? "Save changes" : "Create event"}
          </button>
        </footer>
      </form>
    </div>
  );
}

export function CommunityEventsAdminSection({
  community,
  currentUserId,
  events,
  onCreate,
  onUpdate,
  onCancel,
}: {
  community: Community;
  currentUserId: string;
  events: UpcomingEvent[];
  onCreate: (input: CreateCommunityEventInput) => void | Promise<void>;
  onUpdate: (eventId: string, input: UpdateCommunityEventInput) => void | Promise<void>;
  onCancel: (eventId: string) => void;
}) {
  const [editing, setEditing] = useState<UpcomingEvent | "new" | null>(null);
  const [pendingCancel, setPendingCancel] = useState<UpcomingEvent | null>(null);
  const [rsvp, setRsvp] = useState<Record<string, EventRsvpStatus>>({});
  const [reminders, setReminders] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setRsvp(Object.fromEntries(events.flatMap((event) => (event.currentUserRsvp ? [[event.id, event.currentUserRsvp]] : []))));
    setReminders(Object.fromEntries(events.map((event) => [event.id, eventReminderService.isEnabled(event.id)])));
  }, [events]);

  const visible = useMemo(
    () =>
      events
        .filter((event) => event.communityId === community.id && !event.cancelledAt)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [community.id, events],
  );

  const counts = useMemo(
    () =>
      visible.reduce(
        (summary, event) => {
          const status = rsvp[event.id] ?? event.currentUserRsvp ?? "interested";
          if (status === "going") summary.going += 1;
          if (reminders[event.id]) summary.reminders += 1;
          return summary;
        },
        { upcoming: visible.length, going: 0, reminders: 0 },
      ),
    [reminders, rsvp, visible],
  );

  const updateRsvp = async (event: UpcomingEvent, status: EventRsvpStatus) => {
    if (await communityEventService.setRsvp(event.id, currentUserId, status)) {
      setRsvp((current) => ({ ...current, [event.id]: status }));
      if (status === "not_going" && reminders[event.id]) {
        await eventReminderService.set(event, false, status);
        setReminders((current) => ({ ...current, [event.id]: false }));
      }
    }
  };

  const toggleReminder = async (event: UpcomingEvent) => {
    const enabled = !reminders[event.id];
    if (await eventReminderService.set(event, enabled, rsvp[event.id])) {
      setReminders((current) => ({ ...current, [event.id]: enabled }));
    }
  };

  const confirmCancel = () => {
    if (!pendingCancel) return;
    eventReminderService.cancel(pendingCancel.id);
    onCancel(pendingCancel.id);
    setPendingCancel(null);
  };

  return (
    <section className="community-admin-section community-events-section">
      <header className="community-mgmt-card-header">
        <div className="community-mgmt-card-header-copy">
          <p className="eyebrow">Schedule</p>
          <h3>Events</h3>
          <p>Create, edit, RSVP, and schedule preference-aware desktop reminders.</p>
        </div>
        <span className="community-mgmt-card-icon" aria-hidden="true">
          <AppIcon name="bell" size="md" />
        </span>
      </header>

      <div className="community-mgmt-card community-events-summary-card">
        <div className="community-events-summary-copy">
          <strong>{visible.length} upcoming events</strong>
          <span>RSVP and reminders respect your notification preferences for event reminders.</span>
        </div>
        <button type="button" className="community-mgmt-action" onClick={() => setEditing("new")}>
          <AppIcon name="plus" size="sm" />
          Create event
        </button>
      </div>

      <div className="community-events-metrics" aria-label="Event participation summary">
        <article className="community-events-metric">
          <span className="community-events-metric-icon" aria-hidden="true">
            <AppIcon name="bell" size="sm" />
          </span>
          <strong>{counts.upcoming}</strong>
          <span>Upcoming</span>
        </article>
        <article className="community-events-metric community-events-metric--going">
          <span className="community-events-metric-icon" aria-hidden="true">
            <AppIcon name="users" size="sm" />
          </span>
          <strong>{counts.going}</strong>
          <span>Going</span>
        </article>
        <article className="community-events-metric community-events-metric--reminders">
          <span className="community-events-metric-icon" aria-hidden="true">
            <AppIcon name="inbox" size="sm" />
          </span>
          <strong>{counts.reminders}</strong>
          <span>Reminders on</span>
        </article>
      </div>

      {visible.length ? (
        <div className="community-events-list">
          {visible.map((event) => {
            const currentRsvp = rsvp[event.id] ?? "interested";
            const reminderEnabled = reminders[event.id];
            const canRemind = currentRsvp === "going" || currentRsvp === "interested";

            return (
              <article key={event.id} className="community-events-card">
                <div className="community-events-card-main">
                  <div className="community-events-card-icon" aria-hidden="true">
                    <AppIcon name="bell" size="md" />
                  </div>

                  <div className="community-events-card-copy">
                    <div className="community-events-card-title-row">
                      <strong>{event.title}</strong>
                      <span className="community-mgmt-badge community-events-type-badge">{eventTypeLabel(event.type)}</span>
                    </div>
                    <span>{dateTimeService.formatEventRange(event.startsAt, event.endsAt)}</span>
                    <small>{event.description || "Community event"}</small>
                  </div>
                </div>

                <div className="community-events-card-side">
                  <div className="community-events-rsvp-group" role="group" aria-label={`RSVP for ${event.title}`}>
                    {rsvpOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={currentRsvp === option ? "is-active" : ""}
                        aria-pressed={currentRsvp === option}
                        onClick={() => void updateRsvp(event, option)}
                      >
                        {rsvpLabel(option)}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    className={`community-mgmt-action community-mgmt-action--ghost community-events-reminder-btn${reminderEnabled ? " is-on" : ""}`}
                    disabled={!canRemind}
                    onClick={() => void toggleReminder(event)}
                  >
                    <AppIcon name="bell" size="sm" />
                    {reminderEnabled ? "Reminder on" : "Remind me"}
                  </button>
                </div>

                <div className="community-events-card-actions">
                  <button type="button" className="community-mgmt-action community-mgmt-action--ghost" onClick={() => setEditing(event)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="community-mgmt-action community-mgmt-action--ghost community-mgmt-action--danger"
                    onClick={() => setPendingCancel(event)}
                  >
                    Cancel event
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="community-mgmt-empty community-events-empty">
          <span className="community-events-empty-icon" aria-hidden="true">
            <AppIcon name="bell" size="lg" />
          </span>
          <strong>No upcoming events</strong>
          <span>Create the first event for this community.</span>
          <button type="button" className="community-mgmt-action" onClick={() => setEditing("new")}>
            <AppIcon name="plus" size="sm" />
            Create event
          </button>
        </div>
      )}

      {pendingCancel ? (
        <div className="community-events-cancel-confirm" role="alertdialog" aria-modal="true" aria-labelledby="community-events-cancel-title">
          <span className="community-events-cancel-icon" aria-hidden="true">
            <AppIcon name="trash" size="lg" />
          </span>
          <div className="community-events-cancel-copy">
            <strong id="community-events-cancel-title">Cancel {pendingCancel.title}?</strong>
            <p>Attendees lose the upcoming reminder and the event disappears from community schedules.</p>
          </div>
          <footer className="community-mgmt-footer">
            <button type="button" className="community-mgmt-action community-mgmt-action--ghost" onClick={() => setPendingCancel(null)}>
              Keep event
            </button>
            <button type="button" className="community-mgmt-action community-mgmt-action--danger" onClick={confirmCancel}>
              Confirm cancel
            </button>
          </footer>
        </div>
      ) : null}

      {editing ? (
        <EventEditorModal
          community={community}
          initial={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSave={(input) =>
            editing === "new" ? onCreate(input as CreateCommunityEventInput) : onUpdate(editing.id, input as UpdateCommunityEventInput)
          }
        />
      ) : null}
    </section>
  );
}
