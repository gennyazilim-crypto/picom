import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseClient, getSupabaseClientStatus } from "../supabase/supabaseClient";
import { featureFlagService } from "../featureFlagService";
import { loggingService } from "../loggingService";

export type LiveChatMessageType = "text" | "system" | "moderator_notice";
export type LiveChatModerationState =
  | "visible"
  | "deleted_by_sender"
  | "deleted_by_moderator"
  | "removed_by_system";

export type LiveChatMessage = Readonly<{
  id: string;
  streamId: string;
  senderUserId: string;
  messageType: LiveChatMessageType;
  body: string;
  replyToMessageId: string | null;
  moderationState: LiveChatModerationState;
  createdAt: string;
  deletedAt: string | null;
}>;

export type LiveChatViewerState = Readonly<{
  streamId: string;
  streamStatus: string;
  chatEnabled: boolean;
  emergencyLocked: boolean;
  slowModeSeconds: number;
  followersOnly: boolean;
  verifiedOnly: boolean;
  linksAllowed: boolean;
  reactionsEnabled: boolean;
  maxMessageLength: number;
  isOwner: boolean;
  isModerator: boolean;
  canModerate: boolean;
  isBanned: boolean;
  timeoutExpiresAt: string | null;
  followsOwner: boolean;
  isVerified: boolean;
  pinnedMessage: Readonly<{
    id: string;
    body: string;
    senderUserId: string;
    createdAt: string;
  }> | null;
}>;

export type LiveChatErrorCode =
  | "FEATURE_DISABLED"
  | "DATA_SOURCE_NOT_CONFIGURED"
  | "AUTH_REQUIRED"
  | "VALIDATION_ERROR"
  | "FORBIDDEN"
  | "RATE_LIMITED"
  | "SLOW_MODE"
  | "TIMED_OUT"
  | "BANNED"
  | "DISABLED"
  | "NOT_FOUND"
  | "RPC_FAILED";

export type LiveChatResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{ ok: false; error: { code: LiveChatErrorCode; message: string; retryAfterSeconds?: number } }>;

type MessageRow = {
  id: string;
  stream_id: string;
  sender_user_id: string;
  message_type: string;
  body: string;
  reply_to_message_id: string | null;
  moderation_state: string;
  created_at: string;
  deleted_at: string | null;
};

type RpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message?: string; code?: string; details?: string; hint?: string } | null }>;
};

function fail(code: LiveChatErrorCode, message: string, retryAfterSeconds?: number): LiveChatResult<never> {
  return { ok: false, error: { code, message, retryAfterSeconds } };
}

function gateChat(): LiveChatResult<never> | null {
  if (!featureFlagService.isEnabled("enableLiveChat")) {
    return fail("FEATURE_DISABLED", "Live chat is disabled.");
  }
  return null;
}

function gateModeration(): LiveChatResult<never> | null {
  const chat = gateChat();
  if (chat) return chat;
  if (!featureFlagService.isEnabled("enableLiveModeration")) {
    return fail("FEATURE_DISABLED", "Live moderation is disabled.");
  }
  return null;
}

function clientOrFail(): LiveChatResult<NonNullable<ReturnType<typeof getSupabaseClient>>> {
  const status = getSupabaseClientStatus();
  if (!status.configured) {
    return fail("DATA_SOURCE_NOT_CONFIGURED", status.reason ?? "Supabase is not configured.");
  }
  const client = getSupabaseClient();
  if (!client) return fail("DATA_SOURCE_NOT_CONFIGURED", "Supabase client unavailable.");
  return { ok: true, data: client };
}

function rpc(client: NonNullable<ReturnType<typeof getSupabaseClient>>, fn: string, args: Record<string, unknown> = {}) {
  return (client as unknown as RpcClient).rpc(fn, args);
}

function blob(error: unknown): string {
  if (!error || typeof error !== "object") return String(error ?? "");
  const e = error as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown };
  return [e.message, e.code, e.details, e.hint].filter(Boolean).map(String).join(" ");
}

function mapFailure(error: unknown, fallback: LiveChatErrorCode, message: string): LiveChatResult<never> {
  const text = blob(error).toUpperCase();
  const hintMatch = /HINT[=:]\s*(\d+)/i.exec(blob(error));
  const retryAfterSeconds = hintMatch ? Number(hintMatch[1]) : undefined;
  if (text.includes("AUTH_REQUIRED") || text.includes("JWT")) return fail("AUTH_REQUIRED", "Sign in to use live chat.");
  if (text.includes("BANNED")) return fail("BANNED", "You are banned from this chat.");
  if (text.includes("TIMED_OUT")) return fail("TIMED_OUT", "You are timed out from this chat.", retryAfterSeconds);
  if (text.includes("SLOW_MODE")) return fail("SLOW_MODE", "Slow mode is active.", retryAfterSeconds);
  if (text.includes("RATE_LIMITED")) return fail("RATE_LIMITED", "You are sending too quickly.", retryAfterSeconds);
  if (text.includes("DISABLED") || text.includes("NOT_LIVE")) return fail("DISABLED", "Chat is unavailable right now.");
  if (text.includes("FOLLOWERS_ONLY")) return fail("FORBIDDEN", "Followers-only chat.");
  if (text.includes("VERIFIED_ONLY")) return fail("FORBIDDEN", "Verified-only chat.");
  if (text.includes("FORBIDDEN") || text.includes("42501")) return fail("FORBIDDEN", "Permission denied.");
  if (text.includes("NOT_FOUND") || text.includes("P0002")) return fail("NOT_FOUND", "Not found.");
  if (
    text.includes("22023") ||
    text.includes("TOO_LONG") ||
    text.includes("EMPTY") ||
    text.includes("LINKS") ||
    text.includes("SPAM") ||
    text.includes("DUPLICATE") ||
    text.includes("UNSAFE")
  ) {
    return fail("VALIDATION_ERROR", message);
  }
  loggingService.logWarn("Live chat RPC failed", { fallback, text: text.slice(0, 240) }, "live");
  return fail(fallback, message, retryAfterSeconds);
}

function mapMessage(row: MessageRow): LiveChatMessage {
  return {
    id: row.id,
    streamId: row.stream_id,
    senderUserId: row.sender_user_id,
    messageType: (row.message_type as LiveChatMessageType) || "text",
    body: row.moderation_state === "visible" ? row.body : "",
    replyToMessageId: row.reply_to_message_id,
    moderationState: (row.moderation_state as LiveChatModerationState) || "visible",
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
  };
}

function mapMessages(data: unknown): LiveChatMessage[] {
  if (!Array.isArray(data)) return [];
  return data
    .filter((row): row is MessageRow => Boolean(row && typeof row === "object" && "id" in row))
    .map(mapMessage);
}

function mapViewerState(data: unknown): LiveChatViewerState | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const row = data as Record<string, unknown>;
  const pinned = row.pinnedMessage && typeof row.pinnedMessage === "object"
    ? (row.pinnedMessage as Record<string, unknown>)
    : null;
  return {
    streamId: String(row.streamId ?? ""),
    streamStatus: String(row.streamStatus ?? ""),
    chatEnabled: row.chatEnabled === true,
    emergencyLocked: row.emergencyLocked === true,
    slowModeSeconds: Number(row.slowModeSeconds ?? 0),
    followersOnly: row.followersOnly === true,
    verifiedOnly: row.verifiedOnly === true,
    linksAllowed: row.linksAllowed !== false,
    reactionsEnabled: row.reactionsEnabled !== false,
    maxMessageLength: Number(row.maxMessageLength ?? 500),
    isOwner: row.isOwner === true,
    isModerator: row.isModerator === true,
    canModerate: row.canModerate === true,
    isBanned: row.isBanned === true,
    timeoutExpiresAt: typeof row.timeoutExpiresAt === "string" ? row.timeoutExpiresAt : null,
    followsOwner: row.followsOwner === true,
    isVerified: row.isVerified === true,
    pinnedMessage: pinned && typeof pinned.id === "string"
      ? {
          id: pinned.id,
          body: String(pinned.body ?? ""),
          senderUserId: String(pinned.senderUserId ?? ""),
          createdAt: String(pinned.createdAt ?? ""),
        }
      : null,
  };
}

export const liveChatService = {
  async getViewerState(streamId: string): Promise<LiveChatResult<LiveChatViewerState>> {
    const gate = gateChat();
    if (gate) return gate;
    const configured = clientOrFail();
    if (!configured.ok) return configured;
    const { data, error } = await rpc(configured.data, "get_live_chat_viewer_state", {
      target_stream_id: streamId,
    });
    if (error) return mapFailure(error, "RPC_FAILED", "Could not load chat state.");
    const state = mapViewerState(data);
    if (!state?.streamId) return fail("RPC_FAILED", "Chat state payload incomplete.");
    return { ok: true, data: state };
  },

  async listMessages(
    streamId: string,
    limit = 50,
    before?: { createdAt: string; id: string } | null,
  ): Promise<LiveChatResult<LiveChatMessage[]>> {
    const gate = gateChat();
    if (gate) return gate;
    const configured = clientOrFail();
    if (!configured.ok) return configured;
    const { data, error } = await rpc(configured.data, "list_live_chat_messages", {
      target_stream_id: streamId,
      target_limit: limit,
      before_created_at: before?.createdAt ?? null,
      before_id: before?.id ?? null,
    });
    if (error) return mapFailure(error, "RPC_FAILED", "Could not load chat messages.");
    return { ok: true, data: mapMessages(data).reverse() };
  },

  async sendMessage(input: {
    streamId: string;
    body: string;
    replyToMessageId?: string | null;
    idempotencyKey?: string | null;
  }): Promise<LiveChatResult<LiveChatMessage>> {
    const gate = gateChat();
    if (gate) return gate;
    const configured = clientOrFail();
    if (!configured.ok) return configured;
    const { data, error } = await rpc(configured.data, "send_live_chat_message", {
      target_stream_id: input.streamId,
      message_body: input.body,
      target_reply_to_message_id: input.replyToMessageId ?? null,
      target_idempotency_key: input.idempotencyKey ?? null,
    });
    if (error) return mapFailure(error, "RPC_FAILED", "Could not send message.");
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row !== "object" || !("id" in row)) {
      return fail("RPC_FAILED", "Send returned no message.");
    }
    return { ok: true, data: mapMessage(row as MessageRow) };
  },

  async removeMessage(messageId: string, reason?: string | null): Promise<LiveChatResult<LiveChatMessage>> {
    const gate = gateModeration();
    if (gate) return gate;
    const configured = clientOrFail();
    if (!configured.ok) return configured;
    const { data, error } = await rpc(configured.data, "remove_live_chat_message", {
      target_message_id: messageId,
      target_reason: reason ?? null,
    });
    if (error) return mapFailure(error, "RPC_FAILED", "Could not remove message.");
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row !== "object") return fail("RPC_FAILED", "Remove returned no row.");
    return { ok: true, data: mapMessage(row as MessageRow) };
  },

  async pinMessage(messageId: string): Promise<LiveChatResult<true>> {
    const gate = gateModeration();
    if (gate) return gate;
    const configured = clientOrFail();
    if (!configured.ok) return configured;
    const { error } = await rpc(configured.data, "pin_live_chat_message", {
      target_message_id: messageId,
    });
    if (error) return mapFailure(error, "RPC_FAILED", "Could not pin message.");
    return { ok: true, data: true };
  },

  async unpin(streamId: string): Promise<LiveChatResult<true>> {
    const gate = gateModeration();
    if (gate) return gate;
    const configured = clientOrFail();
    if (!configured.ok) return configured;
    const { error } = await rpc(configured.data, "unpin_live_chat_message", {
      target_stream_id: streamId,
    });
    if (error) return mapFailure(error, "RPC_FAILED", "Could not unpin message.");
    return { ok: true, data: true };
  },

  async timeoutUser(
    streamId: string,
    userId: string,
    durationSeconds: number,
    reason?: string | null,
  ): Promise<LiveChatResult<true>> {
    const gate = gateModeration();
    if (gate) return gate;
    const configured = clientOrFail();
    if (!configured.ok) return configured;
    const { error } = await rpc(configured.data, "timeout_live_chat_user", {
      target_stream_id: streamId,
      target_user_id: userId,
      duration_seconds: durationSeconds,
      target_reason: reason ?? null,
    });
    if (error) return mapFailure(error, "RPC_FAILED", "Could not timeout user.");
    return { ok: true, data: true };
  },

  async banUser(streamId: string, userId: string, reason?: string | null): Promise<LiveChatResult<true>> {
    const gate = gateModeration();
    if (gate) return gate;
    const configured = clientOrFail();
    if (!configured.ok) return configured;
    const { error } = await rpc(configured.data, "ban_live_chat_user", {
      target_stream_id: streamId,
      target_user_id: userId,
      target_reason: reason ?? null,
    });
    if (error) return mapFailure(error, "RPC_FAILED", "Could not ban user.");
    return { ok: true, data: true };
  },

  async unbanUser(streamId: string, userId: string, reason?: string | null): Promise<LiveChatResult<true>> {
    const gate = gateModeration();
    if (gate) return gate;
    const configured = clientOrFail();
    if (!configured.ok) return configured;
    const { error } = await rpc(configured.data, "unban_live_chat_user", {
      target_stream_id: streamId,
      target_user_id: userId,
      target_reason: reason ?? null,
    });
    if (error) return mapFailure(error, "RPC_FAILED", "Could not unban user.");
    return { ok: true, data: true };
  },

  async assignModerator(streamId: string, userId: string): Promise<LiveChatResult<true>> {
    const gate = gateModeration();
    if (gate) return gate;
    const configured = clientOrFail();
    if (!configured.ok) return configured;
    const { error } = await rpc(configured.data, "assign_stream_moderator", {
      target_stream_id: streamId,
      target_user_id: userId,
    });
    if (error) return mapFailure(error, "RPC_FAILED", "Could not assign moderator.");
    return { ok: true, data: true };
  },

  async removeModerator(streamId: string, userId: string): Promise<LiveChatResult<true>> {
    const gate = gateModeration();
    if (gate) return gate;
    const configured = clientOrFail();
    if (!configured.ok) return configured;
    const { error } = await rpc(configured.data, "remove_stream_moderator", {
      target_stream_id: streamId,
      target_user_id: userId,
    });
    if (error) return mapFailure(error, "RPC_FAILED", "Could not remove moderator.");
    return { ok: true, data: true };
  },

  async updateSettings(
    streamId: string,
    patch: {
      chatEnabled?: boolean;
      slowModeSeconds?: number;
      followersOnly?: boolean;
      verifiedOnly?: boolean;
      linksAllowed?: boolean;
      reactionsEnabled?: boolean;
      maxMessageLength?: number;
      emergencyLocked?: boolean;
      emergencyLockReason?: string | null;
    },
  ): Promise<LiveChatResult<true>> {
    const gate = gateModeration();
    if (gate) return gate;
    const configured = clientOrFail();
    if (!configured.ok) return configured;
    const { error } = await rpc(configured.data, "update_live_chat_settings", {
      target_stream_id: streamId,
      target_chat_enabled: patch.chatEnabled ?? null,
      target_slow_mode_seconds: patch.slowModeSeconds ?? null,
      target_followers_only: patch.followersOnly ?? null,
      target_verified_only: patch.verifiedOnly ?? null,
      target_links_allowed: patch.linksAllowed ?? null,
      target_reactions_enabled: patch.reactionsEnabled ?? null,
      target_max_message_length: patch.maxMessageLength ?? null,
      target_emergency_locked: patch.emergencyLocked ?? null,
      target_emergency_lock_reason: patch.emergencyLockReason ?? null,
    });
    if (error) return mapFailure(error, "RPC_FAILED", "Could not update chat settings.");
    return { ok: true, data: true };
  },

  async reportMessage(input: {
    streamId: string;
    messageId: string | null;
    targetUserId: string;
    category: "spam" | "harassment" | "hate" | "sexual" | "scam" | "other";
    description?: string;
  }): Promise<LiveChatResult<true>> {
    const gate = gateChat();
    if (gate) return gate;
    const configured = clientOrFail();
    if (!configured.ok) return configured;
    const { error } = await rpc(configured.data, "report_live_chat_message", {
      target_stream_id: input.streamId,
      target_message_id: input.messageId,
      target_user_id: input.targetUserId,
      target_category: input.category,
      target_description: input.description ?? "",
    });
    if (error) return mapFailure(error, "RPC_FAILED", "Could not submit report.");
    return { ok: true, data: true };
  },

  async react(messageId: string, reactionKey: string): Promise<LiveChatResult<true>> {
    const gate = gateChat();
    if (gate) return gate;
    const configured = clientOrFail();
    if (!configured.ok) return configured;
    const { error } = await rpc(configured.data, "react_live_chat_message", {
      target_message_id: messageId,
      target_reaction_key: reactionKey,
    });
    if (error) return mapFailure(error, "RPC_FAILED", "Could not react.");
    return { ok: true, data: true };
  },

  async getModerationSnapshot(streamId: string): Promise<LiveChatResult<Record<string, unknown>>> {
    const gate = gateModeration();
    if (gate) return gate;
    const configured = clientOrFail();
    if (!configured.ok) return configured;
    const { data, error } = await rpc(configured.data, "list_live_chat_moderation_snapshot", {
      target_stream_id: streamId,
    });
    if (error) return mapFailure(error, "RPC_FAILED", "Could not load moderation snapshot.");
    return { ok: true, data: (data as Record<string, unknown>) ?? {} };
  },

  subscribeMessages(
    streamId: string,
    onEvent: (message: LiveChatMessage, event: "INSERT" | "UPDATE") => void,
  ): { unsubscribe: () => void } {
    const client = getSupabaseClient();
    if (!client || !featureFlagService.isEnabled("enableLiveChat")) {
      return { unsubscribe() {} };
    }
    let channel: RealtimeChannel | null = client
      .channel(`live-chat:${streamId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_chat_messages", filter: `stream_id=eq.${streamId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as MessageRow | null;
          if (!row?.id) return;
          onEvent(mapMessage(row), payload.eventType === "UPDATE" ? "UPDATE" : "INSERT");
        },
      )
      .subscribe();
    return {
      unsubscribe() {
        if (channel) {
          void client.removeChannel(channel);
          channel = null;
        }
      },
    };
  },
};
