import { dataSourceService } from "./dataSourceService";
import { isRateLimitError, rateLimitUserMessage } from "./rateLimitError";
import { getSupabaseClient, getSupabaseClientStatus } from "./supabase/supabaseClient";

export type ReactionSummary = Readonly<{
  messageId: string;
  emoji: string;
  count: number;
  reactedByCurrentUser: boolean;
}>;

export type ReactionMutationInput = Readonly<{
  messageId: string;
  emoji: string;
}>;

export type ReactionServiceErrorCode =
  | "DATA_SOURCE_NOT_CONFIGURED"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "REACTION_MUTATION_FAILED"
  | "REACTION_SUMMARY_FAILED";

export type ReactionServiceResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{ ok: false; error: Readonly<{ code: ReactionServiceErrorCode; message: string }> }>;

type ReactionSummaryRow = Readonly<{
  message_id: string;
  emoji: string;
  reaction_count: number;
  reacted_by_current_user: boolean;
}>;

function failure(code: ReactionServiceErrorCode, message: string): ReactionServiceResult<never> {
  return { ok: false, error: { code, message } };
}

function configuredClient() {
  const status = getSupabaseClientStatus();
  const client = getSupabaseClient();
  if (!status.configured || !client) return failure("DATA_SOURCE_NOT_CONFIGURED", status.reason ?? "Supabase is not configured.");
  return { ok: true as const, data: client };
}

function validate(input: ReactionMutationInput): ReactionServiceResult<true> {
  if (!input.messageId.trim()) return failure("VALIDATION_ERROR", "Message ID is required.");
  if (!input.emoji.trim() || input.emoji.length > 64) return failure("VALIDATION_ERROR", "Choose a valid reaction emoji.");
  return { ok: true, data: true };
}

function mapSummary(row: ReactionSummaryRow): ReactionSummary {
  return {
    messageId: row.message_id,
    emoji: row.emoji,
    count: Math.max(0, Number(row.reaction_count) || 0),
    reactedByCurrentUser: row.reacted_by_current_user === true,
  };
}

async function setReaction(input: ReactionMutationInput, reacted: boolean): Promise<ReactionServiceResult<ReactionSummary>> {
  const validation = validate(input);
  if (!validation.ok) return validation;
  const emoji = input.emoji.trim();

  const dataSource = dataSourceService.getStatus();
  if (dataSource.isMock) {
    return { ok: true, data: { messageId: input.messageId, emoji, count: reacted ? 1 : 0, reactedByCurrentUser: reacted } };
  }

  const configured = configuredClient();
  if (!configured.ok) return configured;
  const { data, error } = await configured.data.rpc("set_message_reaction", {
    target_message_id: input.messageId,
    target_emoji: emoji,
    target_reacted: reacted,
  });
  const row = data?.[0] as ReactionSummaryRow | undefined;
  if (error || !row) {
    if (isRateLimitError(error)) return failure("RATE_LIMITED", rateLimitUserMessage);
    return failure("REACTION_MUTATION_FAILED", "Picom could not update this reaction.");
  }
  return { ok: true, data: mapSummary(row) };
}

export const reactionService = {
  addReaction(input: ReactionMutationInput): Promise<ReactionServiceResult<ReactionSummary>> {
    return setReaction(input, true);
  },

  removeReaction(input: ReactionMutationInput): Promise<ReactionServiceResult<ReactionSummary>> {
    return setReaction(input, false);
  },

  async listSummaries(messageIds: readonly string[]): Promise<ReactionServiceResult<ReactionSummary[]>> {
    const ids = [...new Set(messageIds.filter(Boolean))].slice(0, 100);
    if (!ids.length) return { ok: true, data: [] };
    const dataSource = dataSourceService.getStatus();
    if (dataSource.isMock) return { ok: true, data: [] };
    const configured = configuredClient();
    if (!configured.ok) return configured;
    const { data, error } = await configured.data.rpc("list_message_reaction_summaries", { target_message_ids: ids });
    if (error) return failure("REACTION_SUMMARY_FAILED", "Picom could not load reaction summaries.");
    return { ok: true, data: ((data ?? []) as ReactionSummaryRow[]).map(mapSummary) };
  },
};
