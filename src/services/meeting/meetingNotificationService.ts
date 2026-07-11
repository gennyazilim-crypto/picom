import { dateTimeService } from "../dateTimeService";
import { deepLinkService } from "../deepLinkService";
import { notificationService } from "../notificationService";
import { notificationInboxService, type RemoteNotificationInboxItem } from "../supabase/notificationInboxService";
import type { MeetingNotificationRouteState } from "../../types/meetingNotifications";

const deliveredIds = new Set<string>();
let activeState: MeetingNotificationRouteState = { appFocused: false };

function remember(id: string): boolean {
  if (deliveredIds.has(id)) return false;
  deliveredIds.add(id);
  if (deliveredIds.size > 500) deliveredIds.delete(deliveredIds.values().next().value as string);
  return true;
}

function nativeBody(item: RemoteNotificationInboxItem, timeZone?: string): string {
  const startsAt = item.context.meetingStartsAt;
  if (!startsAt) return item.preview;
  const formatted = dateTimeService.formatEventTime(startsAt, { timeZone });
  return formatted === "\u2014" ? item.preview : `${item.preview} ${formatted}`.trim();
}

async function route(item: RemoteNotificationInboxItem, timeZone?: string): Promise<boolean> {
  const roomId = item.context.meetingRoomId;
  if (!roomId || !remember(item.id)) return false;
  const result = await notificationService.showNotification({
    title: item.title,
    body: nativeBody(item, timeZone),
    category: "event_reminder",
    tag: `meeting:${item.id}`,
    deepLink: item.context.deepLink,
    routing: {
      appFocused: activeState.appFocused,
      activeChannelId: activeState.activeChannelId,
      eventChannelId: item.context.channelId,
      activeMeetingRoomId: activeState.activeMeetingRoomId,
      eventMeetingRoomId: roomId,
      communityId: item.context.communityId,
      channelId: item.context.channelId,
      isNearBottom: activeState.isNearBottom,
    },
  });
  return result.ok;
}

export const meetingNotificationService = {
  setRouteState(next: MeetingNotificationRouteState): void { activeState = { ...next }; },
  formatScheduledTime(value: string, timeZone?: string): string { return dateTimeService.formatEventTime(value, { timeZone }); },
  open(item: RemoteNotificationInboxItem): boolean {
    const link = item.context.deepLink;
    return Boolean(link && deepLinkService.handleDeepLink(link).ok);
  },
  route,
  async start(options: Readonly<{ getRouteState?: () => MeetingNotificationRouteState; timeZone?: string }> = {}): Promise<() => void> {
    return notificationInboxService.subscribeToChanges((item) => {
      if (!item?.context.meetingRoomId) return;
      if (options.getRouteState) activeState = options.getRouteState();
      void route(item, options.timeZone);
    });
  },
};
