import type { Community } from "../../types/community";
import type { UpcomingEvent } from "../../types/events";
import { AppIcon } from "../AppIcon";
import "./GlobalEventsWorkspace.css";

export function GlobalEventsWorkspace({ events, communities, onOpenCommunity }: { events: readonly UpcomingEvent[]; communities: readonly Community[]; onOpenCommunity: (communityId: string) => void }) {
  const upcoming = [...events].filter((event) => !event.cancelledAt && Date.parse(event.startsAt) >= Date.now() - 60_000).sort((left, right) => left.startsAt.localeCompare(right.startsAt));
  return (
    <main className="global-events-workspace" aria-labelledby="global-events-title">
      <header><span aria-hidden="true"><AppIcon name="bell" size="xl" /></span><div><small>Schedule</small><h1 id="global-events-title">Upcoming events</h1><p>Events from communities you can access, ordered by start time.</p></div></header>
      <div className="global-events-list">
        {upcoming.map((event) => {
          const community = communities.find((candidate) => candidate.id === event.communityId);
          return (
            <article key={event.id} className="global-event-card">
              <time dateTime={event.startsAt}><strong>{new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(event.startsAt))}</strong><span>{new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(event.startsAt))}</span></time>
              <div><small>{community?.name ?? "Accessible community"}</small><h2>{event.title}</h2><p>{event.description ?? `${event.type} event`}</p><span><AppIcon name="users" size="xs" /> {event.attendeeCount ?? 0} attending</span></div>
              <button type="button" disabled={!community} onClick={() => community && onOpenCommunity(community.id)}>Open community</button>
            </article>
          );
        })}
        {!upcoming.length ? <div className="global-events-empty"><AppIcon name="bell" size="xl" /><strong>No upcoming events</strong><p>New events from accessible communities will appear here.</p></div> : null}
      </div>
    </main>
  );
}
