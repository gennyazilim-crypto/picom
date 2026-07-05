export type UpcomingEventType = "meeting" | "voice" | "release" | "review" | "social";

export type UpcomingEvent = Readonly<{
  id: string;
  communityId: string;
  title: string;
  startsAt: string;
  attendeeCount?: number;
  type: UpcomingEventType;
}>;
