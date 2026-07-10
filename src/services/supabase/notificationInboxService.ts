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
    userId?: string;
    label: string;
  }>;
}>;

type InboxResult<T> = { ok: true; data: T } | { ok: false; error: "NOTIFICATION_INBOX_UNAVAILABLE" | "NOTIFICATION_INBOX_FAILED" };
const selectColumns = "id,category,title,preview,context_kind,context_label,community_id,channel_id,message_id,user_id,created_at,read_at";

function mapRow(row: Pick<NotificationRow, "id" | "category" | "title" | "preview" | "context_kind" | "context_label" | "community_id" | "channel_id" | "message_id" | "user_id" | "created_at" | "read_at">): RemoteNotificationInboxItem {
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

  async subscribeToChanges(onChange: () => void): Promise<() => void> {
    const client = getSupabaseClient();
    if (!client) return () => undefined;
    const { data: { user } } = await client.auth.getUser();
    if (!user) return () => undefined;
    const channel = client.channel(`notification-inbox:${user.id}`).on(
      "postgres_changes",
      { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${user.id}` },
      () => onChange(),
    ).subscribe();
    return () => { void client.removeChannel(channel); };
  },
};
