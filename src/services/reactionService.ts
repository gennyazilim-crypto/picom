import type { SupabaseClient } from "@supabase/supabase-js";
import { currentUserId } from "../data/mockCommunities";
import { dataSourceService } from "./dataSourceService";
import { getSupabaseClient, getSupabaseClientStatus } from "./supabase/supabaseClient";
import type { Database } from "./supabase/database.types";

export const REACTION_SELECT = "id, message_id, user_id, emoji, created_at" as const;

export type ReactionRow = Readonly<{
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}>;

export type ReactionSummary = Readonly<{
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: string;
}>;

export type AddReactionInput = Readonly<{
  messageId: string;
  emoji: string;
  userId?: string;
}>;

export type RemoveReactionInput = Readonly<{
  messageId: string;
  emoji: string;
  userId?: string;
}>;

export type RemovedReactionSummary = Readonly<{
  messageId: string;
  userId: string;
  emoji: string;
  removed: true;
}>;

export type ReactionServiceErrorCode =
  | "DATA_SOURCE_NOT_CONFIGURED"
  | "AUTH_REQUIRED"
  | "VALIDATION_ERROR"
  | "REACTION_ADD_FAILED"
  | "REACTION_REMOVE_FAILED";

export type ReactionServiceError = Readonly<{
  code: ReactionServiceErrorCode;
  message: string;
}>;

export type ReactionServiceResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{ ok: false; error: ReactionServiceError }>;

function reactionError(code: ReactionServiceErrorCode, message: string): ReactionServiceResult<never> {
  return { ok: false, error: { code, message } };
}

function mapReactionRow(row: ReactionRow): ReactionSummary {
  return {
    id: row.id,
    messageId: row.message_id,
    userId: row.user_id,
    emoji: row.emoji,
    createdAt: row.created_at,
  };
}

function validateReactionInput(input: AddReactionInput | RemoveReactionInput): ReactionServiceError | null {
  if (!input.messageId.trim()) {
    return { code: "VALIDATION_ERROR", message: "Message ID is required." };
  }

  if (!input.emoji.trim()) {
    return { code: "VALIDATION_ERROR", message: "Reaction emoji is required." };
  }

  if (input.emoji.length > 32) {
    return { code: "VALIDATION_ERROR", message: "Reaction emoji is too long." };
  }

  return null;
}

function getConfiguredSupabaseClient() {
  const status = getSupabaseClientStatus();

  if (!status.configured) {
    return reactionError("DATA_SOURCE_NOT_CONFIGURED", status.reason ?? "Supabase data source is not configured.");
  }

  const client = getSupabaseClient();

  if (!client) {
    return reactionError("DATA_SOURCE_NOT_CONFIGURED", "Supabase client is unavailable.");
  }

  return { ok: true as const, data: client };
}

async function getReactionUserId(client: SupabaseClient<Database>, explicitUserId?: string): Promise<ReactionServiceResult<string>> {
  if (explicitUserId?.trim()) {
    return { ok: true, data: explicitUserId.trim() };
  }

  const { data, error } = await client.auth.getUser();

  if (error || !data.user) {
    return reactionError("AUTH_REQUIRED", "Sign in before reacting to messages.");
  }

  return { ok: true, data: data.user.id };
}

export const reactionService = {
  async addReaction(input: AddReactionInput): Promise<ReactionServiceResult<ReactionSummary>> {
    const validationError = validateReactionInput(input);
    if (validationError) return { ok: false, error: validationError };

    const emoji = input.emoji.trim();
    const dataSource = dataSourceService.getStatus();

    if (dataSource.isMock) {
      const idSuffix = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      return {
        ok: true,
        data: {
          id: `mock-reaction-${idSuffix}`,
          messageId: input.messageId,
          userId: input.userId ?? currentUserId,
          emoji,
          createdAt: new Date().toISOString(),
        },
      };
    }

    const configured = getConfiguredSupabaseClient();
    if (!configured.ok) return configured;

    const user = await getReactionUserId(configured.data, input.userId);
    if (!user.ok) return user;

    const { data, error } = await configured.data
      .from("message_reactions")
      .insert({
        message_id: input.messageId,
        user_id: user.data,
        emoji,
      })
      .select(REACTION_SELECT)
      .single();

    if (error || !data) {
      return reactionError("REACTION_ADD_FAILED", "Could not add reaction.");
    }

    return { ok: true, data: mapReactionRow(data) };
  },

  async removeReaction(input: RemoveReactionInput): Promise<ReactionServiceResult<RemovedReactionSummary>> {
    const validationError = validateReactionInput(input);
    if (validationError) return { ok: false, error: validationError };

    const emoji = input.emoji.trim();
    const dataSource = dataSourceService.getStatus();

    if (dataSource.isMock) {
      return {
        ok: true,
        data: {
          messageId: input.messageId,
          userId: input.userId ?? currentUserId,
          emoji,
          removed: true,
        },
      };
    }

    const configured = getConfiguredSupabaseClient();
    if (!configured.ok) return configured;

    const user = await getReactionUserId(configured.data, input.userId);
    if (!user.ok) return user;

    const { error } = await configured.data
      .from("message_reactions")
      .delete()
      .eq("message_id", input.messageId)
      .eq("user_id", user.data)
      .eq("emoji", emoji);

    if (error) {
      return reactionError("REACTION_REMOVE_FAILED", "Could not remove reaction.");
    }

    return {
      ok: true,
      data: {
        messageId: input.messageId,
        userId: user.data,
        emoji,
        removed: true,
      },
    };
  },
};
