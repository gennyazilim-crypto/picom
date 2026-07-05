import type { UpcomingEvent } from "../types/events";

export const mockUpcomingEvents: UpcomingEvent[] = [
  {
    id: "event-aurora-crit",
    communityId: "aurora",
    title: "Design critique sync",
    startsAt: "2026-07-05T15:30:00.000Z",
    attendeeCount: 18,
    type: "review",
  },
  {
    id: "event-north-release",
    communityId: "north",
    title: "Beta release room",
    startsAt: "2026-07-05T18:00:00.000Z",
    attendeeCount: 24,
    type: "release",
  },
  {
    id: "event-terra-voice",
    communityId: "terra",
    title: "Moderator voice huddle",
    startsAt: "2026-07-06T10:15:00.000Z",
    attendeeCount: 9,
    type: "voice",
  },
  {
    id: "event-pixel-social",
    communityId: "pixel",
    title: "Creator lounge",
    startsAt: "2026-07-06T19:45:00.000Z",
    attendeeCount: 31,
    type: "social",
  },
  {
    id: "event-orbit-planning",
    communityId: "orbit",
    title: "Public workspace planning",
    startsAt: "2026-07-07T13:00:00.000Z",
    attendeeCount: 12,
    type: "meeting",
  },
];
