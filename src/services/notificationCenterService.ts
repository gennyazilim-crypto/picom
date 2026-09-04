export type NotificationCenterCategory = "mention" | "reply" | "reaction" | "dm" | "event" | "system";
export type NotificationCenterItem = Readonly<{
  id: string;
  category: NotificationCenterCategory;
  title: string;
  preview: string;
  createdAt: string;
  readAt?: string;
  preferenceCategory?: NotificationCategory;
  context: Readonly<{ kind: "community" | "dm" | "system"; communityId?: string; channelId?: string; messageId?: string; radioSessionId?: string; podcastEpisodeId?: string; meetingRoomId?: string; meetingSessionId?: string; meetingStartsAt?: string; deepLink?: string; userId?: string; label: string }>;
}>;

// Durable notification records are loaded only from public.notifications.

type Listener = (items: NotificationCenterItem[]) => void;
const listeners = new Set<Listener>();
let memoryItems: NotificationCenterItem[] = [];
function load(): NotificationCenterItem[] { return memoryItems; }
function save(items: NotificationCenterItem[]) { memoryItems = items; for(const listener of listeners) listener(items); }

function routeCategory(category: NotificationCenterCategory): NotificationCategory {
  if (category === "mention") return "mention";
  if (category === "reply") return "reply";
  if (category === "reaction") return "reaction";
  if (category === "dm") return "direct_message";
  if (category === "event") return "event_reminder";
  return "system";
}

function shouldStoreInInbox(item: NotificationCenterItem): boolean {
  const settings = settingsService.getSettings().notificationSettings;
  return decideNotificationRoute({
    category: item.preferenceCategory ?? routeCategory(item.category),
    isMention: item.category === "mention",
    doNotDisturb: settings.muted,
    communityId: item.context.communityId,
    channelId: item.context.channelId,
    settings,
  }).inbox;
}

function isRemoteId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

function mapRemote(items: RemoteNotificationInboxItem[]): NotificationCenterItem[] {
  return items.filter(shouldStoreInInbox).map((item) => ({ ...item }));
}

export const notificationCenterService = {
  list(): NotificationCenterItem[] { return [...load()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)); },
  add(item: NotificationCenterItem): void { if (!shouldStoreInInbox(item)) return; save([item, ...load().filter((candidate) => candidate.id !== item.id)].slice(0, 250)); },
  unreadCount(): number { return load().filter((item)=>!item.readAt).length; },
  markRead(id: string): void { save(load().map((item)=>item.id===id && !item.readAt ? {...item,readAt:new Date().toISOString()} : item)); if (dataSourceService.getStatus().isSupabase && isRemoteId(id)) void notificationInboxService.markRead(id); },
  markAllRead(): void { const now=new Date().toISOString(); save(load().map((item)=>item.readAt ? item : {...item,readAt:now})); if (dataSourceService.getStatus().isSupabase) void notificationInboxService.markAllRead(); },
  delete(id: string): void { save(load().filter((item) => item.id !== id)); if (dataSourceService.getStatus().isSupabase && isRemoteId(id)) void notificationInboxService.softDelete(id); },
  replaceFromRemote(items: NotificationCenterItem[]): void { save(items); },
  subscribe(listener: Listener): () => void { listeners.add(listener); return ()=>listeners.delete(listener); },
  openDeepLink(item: NotificationCenterItem): boolean { const link=item.context.deepLink; return Boolean(link&&deepLinkService.handleDeepLink(link).ok); },
  startRemoteSync(): () => void {
    if (!dataSourceService.getStatus().isSupabase) return () => undefined;
    let active = true;
    let unsubscribeRemote: (() => void) | undefined;
    const refresh = async () => {
      const result = await notificationInboxService.list();
      if (active && result.ok) save(mapRemote(result.data));
    };
    void refresh();
    void notificationInboxService.subscribeToChanges(() => { void refresh(); }).then((cleanup) => {
      if (!active) cleanup(); else unsubscribeRemote = cleanup;
    });
    return () => { active = false; unsubscribeRemote?.(); };
  },
};
import { dataSourceService } from "./dataSourceService";
import { decideNotificationRoute, type NotificationCategory } from "./notificationService";
import { settingsService } from "./settingsService";
import { notificationInboxService, type RemoteNotificationInboxItem } from "./supabase/notificationInboxService";
import { deepLinkService } from "./deepLinkService";
