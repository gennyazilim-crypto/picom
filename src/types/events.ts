export type UpcomingEventType = "meeting" | "voice" | "release" | "review" | "social";

export type UpcomingEvent = Readonly<{
  id: string;
  communityId: string;
  title: string;
  description?: string;
  channelId?: string;
  startsAt: string;
  endsAt?: string;
  attendeeCount?: number;
  type: UpcomingEventType;
  createdBy?: string;
  cancelledAt?: string;
  createdAt?: string;
  updatedAt?: string;
}>;
