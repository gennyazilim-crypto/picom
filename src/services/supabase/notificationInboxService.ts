import { loggingService } from "../loggingService";
import { getSupabaseClient } from "./supabaseClient";
import type { Database } from "./database.types";

type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];
export type RemoteNotificationInboxItem = Readonly<{
  id: string;
  category: NotificationRow["category"];
  title: string;
  preview: string;
  createdAt: string;
  readAt?: string;
  context: Readonly<{
    kind: NotificationRow["context_kind"];
    communityId?: string;
    channelId?: string;
    messageId?: string;
    podcastEpisodeId?: string;
    meetingRoomId?: string;
    meetingSessionId?: string;
    meetingStartsAt?: string;
    deepLink?: string;
    userId?: string;
    label: string;
  }>;
}>;

type InboxResult<T> = { ok: true; data: T } | { ok: false; error: "NOTIFICATION_INBOX_UNAVAILABLE" | "NOTIFICATION_INBOX_FAILED" };
const selectColumns = "id,category,title,preview,context_kind,context_label,community_id,channel_id,message_id,podcast_episode_id,meeting_room_id,meeting_session_id,meeting_starts_at,deep_link,user_id,created_at,read_at";
const baseSelectColumns = "id,category,title,preview,context_kind,context_label,community_id,channel_id,message_id,user_id,created_at,read_at";
type NotificationProjection = Pick<NotificationRow, "id" | "category" | "title" | "preview" | "context_kind" | "context_label" | "community_id" | "channel_id" | "message_id" | "user_id" | "created_at" | "read_at"> & Partial<Pick<NotificationRow, "podcast_episode_id" | "meeting_room_id" | "meeting_session_id" | "meeting_starts_at" | "deep_link">>;

function mapRow(row: NotificationProjection): RemoteNotificationInboxItem {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    preview: row.preview,
    createdAt: row.created_at,
    readAt: row.read_at ?? undefined,
    context: {
      kind: row.context_kind,
      communityId: row.community_id ?? undefined,
      channelId: row.channel_id ?? undefined,
      messageId: row.message_id ?? undefined,
      podcastEpisodeId: row.podcast_episode_id ?? undefined,
      meetingRoomId: row.meeting_room_id ?? undefined,
      meetingSessionId: row.meeting_session_id ?? undefined,
      meetingStartsAt: row.meeting_starts_at ?? undefined,
      deepLink: row.deep_link ?? undefined,
      userId: row.user_id ?? undefined,
      label: row.context_label,
    },
  };
}

function logFailure(operation: string, code?: string): void {
  loggingService.logWarn("Notification inbox operation failed", { operation, code: code ?? "unknown" }, "notification-inbox");
}

export const notificationInboxService = {
  async list(limit = 100): Promise<InboxResult<RemoteNotificationInboxItem[]>> {
    const client = getSupabaseClient();
    if (!client) return { ok: false, error: "NOTIFICATION_INBOX_UNAVAILABLE" };
    const { data, error } = await client.from("notifications").select(selectColumns).is("deleted_at", null).order("created_at", { ascending: false }).limit(Math.min(250, Math.max(1, limit)));
    if (error?.code === "42703") {
      loggingService.logWarn("Notification inbox is using the base schema until hosted migrations are applied", { operation: "list", code: error.code }, "notification-inbox");
      const fallback = await client.from("notifications").select(baseSelectColumns).is("deleted_at", null).order("created_at", { ascending: false }).limit(Math.min(250, Math.max(1, limit)));
      if (fallback.error) { logFailure("list-base-schema", fallback.error.code); return { ok: false, error: "NOTIFICATION_INBOX_FAILED" }; }
      return { ok: true, data: (fallback.data ?? []).map((row) => mapRow(row)) };
    }
    if (error) { logFailure("list", error.code); return { ok: false, error: "NOTIFICATION_INBOX_FAILED" }; }
    return { ok: true, data: (data ?? []).map((row) => mapRow(row)) };
  },

  async markRead(id: string): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;
    const { error } = await client.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).is("deleted_at", null);
    if (error) { logFailure("mark-read", error.code); return false; }
    return true;
  },

  async markAllRead(): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;
    const { error } = await client.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null).is("deleted_at", null);
    if (error) { logFailure("mark-all-read", error.code); return false; }
    return true;
  },

  async softDelete(id: string): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;
    const { error } = await client.from("notifications").update({ deleted_at: new Date().toISOString() }).eq("id", id).is("deleted_at", null);
    if (error) { logFailure("soft-delete", error.code); return false; }
    return true;
  },

  async subscribeToChanges(onChange: (item?: RemoteNotificationInboxItem) => void): Promise<() => void> {
    const client = getSupabaseClient();
    if (!client) return () => undefined;
    const { data: { user } } = await client.auth.getUser();
    if (!user) return () => undefined;
    const subscriptionId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const channel = client.channel(`notification-inbox:${user.id}:${subscriptionId}`).on(
      "postgres_changes",
      { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${user.id}` },
      (payload) => {
        const row = payload.new as NotificationRow;
        onChange(row?.id ? mapRow(row) : undefined);
      },
    ).subscribe();
    return () => { void client.removeChannel(channel); };
  },
};
