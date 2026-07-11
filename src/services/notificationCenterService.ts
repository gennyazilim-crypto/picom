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

const STORAGE_KEY = "picom.notificationCenter.v1";
const seeded: NotificationCenterItem[] = [
  { id:"notice-1",category:"mention",title:"Mira mentioned you",preview:"The desktop layout review is ready.",createdAt:"2026-07-10T09:45:00.000Z",context:{kind:"community",communityId:"community-aurora",channelId:"aurora-general",messageId:"aurora-msg-4",label:"Aurora Studio · general"}},
  { id:"notice-2",category:"reply",title:"Jonas replied",preview:"I tested the compact composer behavior.",createdAt:"2026-07-10T09:10:00.000Z",context:{kind:"community",communityId:"community-aurora",channelId:"aurora-general",label:"Aurora Studio · general"}},
  { id:"notice-3",category:"reaction",title:"New reactions",preview:"Three people reacted to your message.",createdAt:"2026-07-10T08:52:00.000Z",context:{kind:"community",communityId:"community-north",channelId:"north-general",label:"North Guild · general"}},
  { id:"notice-4",category:"dm",title:"Direct message from Krishna",preview:"You received a private message.",createdAt:"2026-07-10T08:31:00.000Z",context:{kind:"dm",userId:"u-krishna",label:"Direct messages"}},
  { id:"notice-5",category:"event",title:"Design review starts soon",preview:"The community event begins in 30 minutes.",createdAt:"2026-07-10T08:05:00.000Z",context:{kind:"community",communityId:"community-pixel",channelId:"pixel-general",label:"Pixel Foundry · event"}},
  { id:"notice-6",category:"system",title:"Privacy settings updated",preview:"Your notification and privacy preferences were saved.",createdAt:"2026-07-09T21:40:00.000Z",readAt:"2026-07-09T21:41:00.000Z",context:{kind:"system",label:"Picom"}},
  { id:"notice-7",category:"mention",title:"Deniz mentioned you",preview:"Can you review the moderation notes?",createdAt:"2026-07-09T20:18:00.000Z",context:{kind:"community",communityId:"community-terra",channelId:"terra-general",label:"Terra Hub · general"}},
  { id:"notice-8",category:"reaction",title:"Yuna reacted",preview:"Your shared image received a reaction.",createdAt:"2026-07-09T18:12:00.000Z",readAt:"2026-07-09T18:20:00.000Z",context:{kind:"community",communityId:"community-pixel",channelId:"pixel-general",label:"Pixel Foundry · media"}},
  { id:"notice-9",category:"reply",title:"Atlas replied",preview:"The release checklist was updated.",createdAt:"2026-07-09T16:55:00.000Z",context:{kind:"community",communityId:"community-north",channelId:"north-general",label:"North Guild · releases"}},
  { id:"notice-10",category:"dm",title:"Direct message from Nainesh",preview:"You received a private message.",createdAt:"2026-07-09T15:32:00.000Z",readAt:"2026-07-09T15:40:00.000Z",context:{kind:"dm",userId:"u-naines",label:"Direct messages"}},
  { id:"notice-11",category:"event",title:"Voice meetup scheduled",preview:"Eight friends are interested.",createdAt:"2026-07-09T12:00:00.000Z",context:{kind:"community",communityId:"community-orbit",channelId:"orbit-general",label:"Orbit Lounge · event"}},
  { id:"notice-12",category:"system",title:"Mock workspace ready",preview:"Picom is running in local mock mode.",createdAt:"2026-07-09T10:00:00.000Z",readAt:"2026-07-09T10:02:00.000Z",context:{kind:"system",label:"Picom Desktop"}},
  { id:"notice-13",category:"mention",title:"You were mentioned in a Podcast",preview:"The rollback checklist is ready to verify.",createdAt:"2026-07-10T10:20:00.000Z",context:{kind:"community",communityId:"picom-podcast",podcastEpisodeId:"podcast-north-01",label:"Picom Podcast / Shipping a desktop beta"}},
];

type Listener = (items: NotificationCenterItem[]) => void;
const listeners = new Set<Listener>();
let memoryItems: NotificationCenterItem[] | null = null;
function load(): NotificationCenterItem[] { if (memoryItems) return memoryItems; try { const raw=window.localStorage.getItem(STORAGE_KEY); memoryItems=raw ? JSON.parse(raw) as NotificationCenterItem[] : seeded; } catch { memoryItems=seeded; } return memoryItems; }
function save(items: NotificationCenterItem[]) { memoryItems=items; try { window.localStorage.setItem(STORAGE_KEY,JSON.stringify(items)); } catch { /* restricted desktop fallback */ } for(const listener of listeners) listener(items); }

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
