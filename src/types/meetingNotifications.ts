export type MeetingNotificationKind =
  | "reminder"
  | "started"
  | "schedule_changed"
  | "cancelled"
  | "invite_received"
  | "waiting_request"
  | "admission_result"
  | "cohost_assigned"
  | "stage_request";

export type MeetingNotificationRouteState = Readonly<{
  appFocused: boolean;
  activeMeetingRoomId?: string | null;
  activeMeetingSessionId?: string | null;
  activeChannelId?: string | null;
  isNearBottom?: boolean;
}>;

export type MeetingNotificationContext = Readonly<{
  roomId: string;
  sessionId?: string;
  communityId?: string;
  channelId?: string;
  startsAt?: string;
  deepLink: string;
}>;
