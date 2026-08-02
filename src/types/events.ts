export type UpcomingEventType =
  | "meeting"
  | "voice"
  | "release"
  | "review"
  | "social"
  | "community_event"
  | "voice_event"
  | "radio_event"
  | "podcast_event"
  | "gaming_event"
  | "announcement"
  | "general"
  | "private"
  | "invite_only"
  | "online"
  | "physical"
  | "video"
  | "livestream"
  | "tournament"
  | "workshop"
  | "conference"
  | "education"
  | "game";

export type EventCategory =
  | "general"
  | "social"
  | "gaming"
  | "education"
  | "conference"
  | "workshop"
  | "tournament"
  | "voice"
  | "video"
  | "livestream"
  | "meeting"
  | "community";

export type EventRsvpStatus =
  | "interested"
  | "going"
  | "maybe"
  | "not_going"
  | "declined"
  | "attended"
  | "waitlisted"
  | "pending_approval";

export type EventStatus = "draft" | "published" | "live" | "completed" | "cancelled";
export type EventVisibility = "public" | "followers" | "community_only" | "private" | "secret";
export type EventLocationType =
  | "community"
  | "voice_room"
  | "video_room"
  | "radio"
  | "podcast"
  | "external"
  | "physical"
  | "tbd"
  | "none";

export type EventInviteStatus = "pending" | "accepted" | "declined" | "expired" | "cancelled";

export type EventListFilter =
  | "discover"
  | "upcoming"
  | "going"
  | "invites"
  | "created"
  | "past"
  | "today"
  | "week"
  | "month"
  | "online"
  | "community";

export type UpcomingEvent = Readonly<{
  id: string;
  communityId: string;
  title: string;
  shortDescription?: string;
  description?: string;
  channelId?: string;
  startsAt: string;
  endsAt?: string;
  attendeeCount?: number;
  goingCount?: number;
  waitlistCount?: number;
  capacity?: number | null;
  type: UpcomingEventType;
  category?: EventCategory;
  createdBy?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  createdAt?: string;
  updatedAt?: string;
  currentUserRsvp?: EventRsvpStatus;
  waitlistPosition?: number | null;
  source?: "community" | "radio";
  radioSessionId?: string;
  reminderSet?: boolean;
  scheduleTimezone?: string;
  status?: EventStatus;
  visibility?: EventVisibility;
  coverImage?: string;
  locationType?: EventLocationType | string;
  locationData?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  publishedAt?: string;
  completedAt?: string;
  liveAt?: string;
  featuredUntil?: string;
  approvalRequired?: boolean;
  attendeeVisibility?: string;
  chatEnabled?: boolean;
  language?: string;
  ageLimit?: number | null;
  rules?: string;
  tags?: readonly string[];
  isAllDay?: boolean;
  recurrenceRule?: string;
  externalMeetingUrl?: string;
  livekitRoomName?: string;
  organizerName?: string;
  communityName?: string;
  inviteStatus?: EventInviteStatus;
}>;

export type CreateEventInput = Readonly<{
  title: string;
  shortDescription?: string;
  description?: string;
  communityId?: string | null;
  eventType?: UpcomingEventType;
  category?: EventCategory;
  visibility?: EventVisibility;
  status?: "draft" | "published";
  startsAt: string;
  endsAt?: string | null;
  timezone?: string;
  isAllDay?: boolean;
  locationType?: EventLocationType;
  locationData?: Record<string, unknown>;
  capacity?: number | null;
  approvalRequired?: boolean;
  attendeeVisibility?: string;
  chatEnabled?: boolean;
  language?: string;
  ageLimit?: number | null;
  rules?: string;
  cancellationPolicy?: string;
  recurrenceRule?: string;
  tags?: readonly string[];
  coverImage?: string;
  externalMeetingUrl?: string;
  livekitRoomName?: string;
  metadata?: Record<string, unknown>;
}>;

export type EventInvitation = Readonly<{
  id: string;
  eventId: string;
  userId?: string | null;
  invitedEmail?: string | null;
  status: EventInviteStatus;
  expiresAt?: string | null;
  createdAt: string;
}>;

export type EventRsvpResult = Readonly<{
  status: EventRsvpStatus;
  waitlistPosition?: number | null;
}>;
