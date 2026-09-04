import { featureFlagService } from "../featureFlagService";
import { loggingService } from "../loggingService";
import { decideNotificationRoute, type NotificationCategory } from "../notificationService";
import { translateSettings, type SettingsI18nKey } from "../settings/settingsI18n";
import { settingsService } from "../settingsService";
import { getSupabaseClient } from "../supabase/supabaseClient";

type NotificationType = "friend_request_received" | "friend_request_accepted" | "dm_received" | "friend_online" | "followed_user_live" | "followed_publisher_live";
type ToastAction = "open" | "dismiss" | "accept" | "decline" | "message" | "watch-live";

export type ProductionDesktopNotification = Readonly<{
  id: string;
  type: NotificationType;
  safeMetadata: Readonly<Record<string, unknown>>;
  createdAt: string;
}>;

type StartInput = Readonly<{
  currentUserId: string;
  activeConversationId: string;
  isDirectMessagesViewActive: boolean;
  onAction: (notification: ProductionDesktopNotification, action: Exclude<ToastAction, "dismiss">) => void;
}>;

type RpcClient = Readonly<{
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
}>;

let activeCleanup: (() => void) | null = null;
let displayed = new Set<string>();
let cache = new Map<string, ProductionDesktopNotification>();

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asNotificationType(value: unknown): NotificationType | null {
  return value === "friend_request_received" || value === "friend_request_accepted" || value === "dm_received" || value === "friend_online" || value === "followed_user_live" || value === "followed_publisher_live" ? value : null;
}

function categoryFor(type: NotificationType): NotificationCategory {
  if (type === "friend_request_received") return "friend_request";
  if (type === "friend_request_accepted") return "friend_acceptance";
  if (type === "dm_received") return "direct_message";
  if (type === "friend_online") return "friend_online";
  return type === "followed_publisher_live" ? "followed_publisher_live" : "followed_user_live";
}

function text(key: SettingsI18nKey, params?: Record<string, string | number>): string {
  const locale = settingsService.getSettings().appearanceSettings.language;
  return translateSettings(key, locale, params);
}

function safeName(metadata: Record<string, unknown>): string {
  const name = typeof metadata.actor_display_name === "string" ? metadata.actor_display_name.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 80) : "";
  return name || text("notifications.desktop.someone");
}

function toDesktopPayload(notification: ProductionDesktopNotification): NonNullable<Window["picomDesktop"]>["desktopNotificationToast"] extends infer Bridge ? Bridge extends { show: (payload: infer Payload) => unknown } ? Payload : never : never {
  const metadata = notification.safeMetadata;
  const actor = safeName(metadata);
  const closeLabel = text("notifications.desktop.dismiss");
  const soundEnabled = settingsService.getSettings().notificationSettings.soundEnabled;
  if (notification.type === "friend_request_received") {
    return { notificationId: notification.id, type: "friend-request", title: actor, body: text("notifications.desktop.friendRequestReceived.body"), closeLabel, soundEnabled, accent: "indigo", primaryAction: { action: "accept", label: text("notifications.desktop.accept") }, secondaryAction: { action: "decline", label: text("notifications.desktop.decline") } };
  }
  if (notification.type === "friend_request_accepted") {
    return { notificationId: notification.id, type: "friend-accepted", title: actor, body: text("notifications.desktop.friendRequestAccepted.body"), closeLabel, soundEnabled, accent: "teal", primaryAction: { action: "message", label: text("notifications.desktop.message") }, secondaryAction: { action: "open", label: text("notifications.desktop.viewProfile") } };
  }
  if (notification.type === "dm_received") {
    const preview = settingsService.getSettings().notificationSettings.showMessagePreview && typeof metadata.message_preview === "string"
      ? metadata.message_preview.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 180)
      : text("notifications.desktop.dmReceived.hidden");
    return { notificationId: notification.id, type: "dm", title: actor, body: preview, closeLabel, soundEnabled, accent: "indigo", primaryAction: { action: "open", label: text("notifications.desktop.openConversation") } };
  }
  if (notification.type === "friend_online") {
    return { notificationId: notification.id, type: "friend-online", title: actor, body: text("notifications.desktop.friendOnline.body"), closeLabel, soundEnabled, accent: "teal", primaryAction: { action: "open", label: text("notifications.desktop.viewProfile") } };
  }
  const streamTitle = typeof metadata.stream_title === "string" ? metadata.stream_title.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 120) : "";
  return { notificationId: notification.id, type: "live", title: actor, body: streamTitle || text("notifications.desktop.liveNow.body"), closeLabel, soundEnabled, accent: "rose", primaryAction: { action: "watch-live", label: text("notifications.desktop.watchLive") } };
}

function shouldShow(notification: ProductionDesktopNotification, input: StartInput): boolean {
  const category = categoryFor(notification.type);
  const conversationId = typeof notification.safeMetadata.conversation_id === "string" ? notification.safeMetadata.conversation_id : undefined;
  const isActiveDirectConversation = notification.type === "dm_received"
    && input.isDirectMessagesViewActive
    && Boolean(conversationId)
    && conversationId === input.activeConversationId;
  return decideNotificationRoute({
    category,
    appFocused: typeof document !== "undefined" && document.hasFocus(),
    activeChannelId: input.isDirectMessagesViewActive ? `dm:${input.activeConversationId}` : null,
    eventChannelId: conversationId ? `dm:${conversationId}` : null,
    isNearBottom: isActiveDirectConversation,
  }).desktop;
}

async function claim(id: string): Promise<ProductionDesktopNotification | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const result = await (client as unknown as RpcClient).rpc("claim_desktop_notification", { target_notification_id: id });
  if (result.error || !Array.isArray(result.data) || result.data.length !== 1) return null;
  const row = asRecord(result.data[0]);
  const type = asNotificationType(row.notification_type);
  const notificationId = typeof row.notification_id === "string" ? row.notification_id : "";
  if (!type || !notificationId) return null;
  return { id: notificationId, type, safeMetadata: asRecord(row.safe_metadata), createdAt: typeof row.created_at === "string" ? row.created_at : new Date().toISOString() };
}

function parseNotificationRow(value: unknown): ProductionDesktopNotification | null {
  const row = asRecord(value);
  const type = asNotificationType(row.notification_type);
  const notificationId = typeof row.notification_id === "string" ? row.notification_id : "";
  if (!type || !notificationId) return null;
  return {
    id: notificationId,
    type,
    safeMetadata: asRecord(row.safe_metadata),
    createdAt: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
  };
}

async function listRecentDeliveryCandidates(): Promise<string[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const result = await (client as unknown as RpcClient).rpc("list_recent_desktop_notification_delivery_candidates", { limit_count: 10 });
  if (result.error || !Array.isArray(result.data)) return [];
  return result.data.map(parseNotificationRow).filter((item): item is ProductionDesktopNotification => item !== null).map((item) => item.id);
}

async function updateDesktopState(id: string, operation: "dismiss" | "read" | "seen"): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  const rpc = operation === "dismiss"
    ? "dismiss_desktop_notification"
    : operation === "seen"
      ? "mark_desktop_notification_seen"
      : "mark_desktop_notification_read";
  const result = await (client as unknown as RpcClient).rpc(rpc, { target_notification_id: id });
  if (result.error) loggingService.logWarn("Desktop notification state update failed", { operation, code: result.error.code ?? "unknown" }, "desktop-notifications");
}

async function deliver(id: string, input: StartInput): Promise<void> {
  if (displayed.has(id)) return;
  const notification = await claim(id);
  if (!notification || !shouldShow(notification, input)) return;
  const bridge = window.picomDesktop?.desktopNotificationToast;
  if (!bridge) return;
  const result = await bridge.show(toDesktopPayload(notification));
  if (!result.ok) {
    loggingService.logWarn("Desktop notification host rejected a trusted payload", { code: result.error }, "desktop-notifications");
    return;
  }
  displayed.add(notification.id);
  cache.set(notification.id, notification);
  void updateDesktopState(notification.id, "seen");
  if (displayed.size > 500) displayed = new Set([...displayed].slice(-250));
}

export const productionNotificationService = {
  start(input: StartInput): () => void {
    activeCleanup?.();
    displayed = new Set();
    cache = new Map();
    if (!featureFlagService.isEnabled("DESKTOP_NOTIFICATIONS_ENABLED") || !window.picomDesktop?.desktopNotificationToast) return () => undefined;
    const client = getSupabaseClient();
    if (!client) return () => undefined;
    const actionCleanup = window.picomDesktop.desktopNotificationToast.onAction((event) => {
      const notification = cache.get(event.notificationId);
      if (!notification) return;
      if (event.action === "dismiss") {
        void updateDesktopState(notification.id, "dismiss");
        return;
      }
      void updateDesktopState(notification.id, "read");
      input.onAction(notification, event.action);
    });
    const channel = client.channel(`desktop-notifications:${input.currentUserId}:${Date.now().toString(36)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${input.currentUserId}` }, (event) => {
        const row = asRecord(event.new);
        const type = asNotificationType(row.notification_type);
        if (type && typeof row.id === "string") void deliver(row.id, input);
      })
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        void listRecentDeliveryCandidates().then((ids) => Promise.all(ids.map((id) => deliver(id, input))));
      });
    activeCleanup = () => {
      actionCleanup();
      void client.removeChannel(channel);
      displayed.clear();
      cache.clear();
    };
    return activeCleanup;
  },
};
