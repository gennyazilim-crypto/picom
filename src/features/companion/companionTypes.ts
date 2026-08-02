export type CompanionWindowType =
  | "home"
  | "chat"
  | "voice"
  | "video"
  | "community"
  | "dock"
  | "bubble"
  | "settings"
  | "notification"
  | "gaming";

export type CompanionDockEdge = "left" | "right" | "top" | "bottom";

export type CompanionStartupMode = "main" | "companion";
export type CompanionDockLayout = "collapsed" | "rail" | "expanded";

export type CompanionRoute = Readonly<{
  type: CompanionWindowType;
  conversationId?: string;
  callId?: string;
  communityId?: string;
  channelId?: string;
}>;

export type CompanionPreferences = Readonly<{
  version: 1;
  startupMode: CompanionStartupMode;
  alwaysOnTop: boolean;
  compactDensity: boolean;
  closeToTray: boolean;
  showNotifications: boolean;
  theme: "system" | "light" | "dark";
  windowOpacity: number;
  dockEdge: CompanionDockEdge;
  smartCollapse: boolean;
  dockAutoHide: boolean;
  gamingAutoDetect: boolean;
}>;

export type CompanionPerson = Readonly<{
  userId: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
  status: "online" | "idle" | "busy" | "offline";
  favorite: boolean;
  conversationId?: string;
  unreadCount?: number;
  activityLabel?: string;
  lastMessagePreview?: string;
}>;

export type CompanionCommunity = Readonly<{
  id: string;
  name: string;
  description?: string;
  iconUrl?: string;
}>;

export type CompanionVoiceRoom = Readonly<{
  id: string;
  communityId: string;
  name: string;
  communityName: string;
  participantCount: number;
}>;

export type CompanionHomeSnapshot = Readonly<{
  currentUser: Readonly<{ userId: string; displayName: string; username: string }> | null;
  people: readonly CompanionPerson[];
  communities: readonly CompanionCommunity[];
  conversations: readonly unknown[];
  voiceRooms: readonly CompanionVoiceRoom[];
  totalUnread: number;
  updatedAt: string;
}>;

const WINDOW_TYPES = new Set<CompanionWindowType>([
  "home", "chat", "voice", "video", "community", "dock", "bubble", "settings", "notification", "gaming",
]);

function resolveWindowType(value: string | null): CompanionWindowType {
  if (value && WINDOW_TYPES.has(value as CompanionWindowType)) return value as CompanionWindowType;
  return "home";
}

export function parseCompanionRoute(search = window.location.search): CompanionRoute {
  const params = new URLSearchParams(search);
  const type = resolveWindowType(params.get("type") ?? params.get("surface"));
  const optional = (name: string) => params.get(name) || undefined;
  return Object.freeze({
    type,
    conversationId: optional("conversationId"),
    callId: optional("callId"),
    communityId: optional("communityId"),
    channelId: optional("channelId"),
  });
}

export function companionStatusLabel(status: CompanionPerson["status"]): string {
  switch (status) {
    case "online": return "Çevrimiçi";
    case "idle": return "Boşta";
    case "busy": return "Rahatsız Etmeyin";
    default: return "Çevrimdışı";
  }
}
