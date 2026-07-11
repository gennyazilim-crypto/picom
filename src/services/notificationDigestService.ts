import type { NotificationSettings } from "./settingsService";
import type { NotificationCategory } from "../types/notifications";

export type NotificationDigestMode = "off" | "hourly_placeholder" | "daily_placeholder";

export type DigestNotificationItem = Readonly<{
  id: string;
  communityId?: string;
  channelId?: string;
  title: string;
  createdAt: string;
  category: "mention" | "message" | "system";
  unread?: boolean;
}>;

export type DigestNotificationGroup = Readonly<{
  key: string;
  communityId: string;
  channelId: string;
  date: string;
  items: DigestNotificationItem[];
  unreadCount: number;
}>;

function getDateKey(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "unknown-date";
  }

  return date.toISOString().slice(0, 10);
}

export const notificationDigestService = {
  shouldDigestNotification(settings: NotificationSettings, category: NotificationCategory, isMention: boolean): boolean {
    return settings.digestMode !== "off" && category === "message" && !isMention;
  },

  getDigestModeLabel(mode: NotificationDigestMode): string {
    if (mode === "hourly_placeholder") return "Hourly digest";
    if (mode === "daily_placeholder") return "Daily digest";
    return "Off";
  },

  groupNotifications(items: DigestNotificationItem[]): DigestNotificationGroup[] {
    const groups = new Map<string, DigestNotificationGroup>();

    for (const item of items) {
      const communityId = item.communityId ?? "unknown-community";
      const channelId = item.channelId ?? "unknown-channel";
      const date = getDateKey(item.createdAt);
      const key = `${communityId}:${channelId}:${date}`;
      const current = groups.get(key);
      const nextItems = [...(current?.items ?? []), item];

      groups.set(key, {
        key,
        communityId,
        channelId,
        date,
        items: nextItems,
        unreadCount: nextItems.filter((candidate) => candidate.unread).length,
      });
    }

    return [...groups.values()];
  }
};
