import type { RealtimeChannel } from "@supabase/supabase-js";
import type { CreatePollDraft, PollData, PollOption } from "../types/polls";
import { dataSourceService } from "./dataSourceService";
import { getSupabaseClient } from "./supabase/supabaseClient";

type Result<T> = { ok: true; data: T } | { ok: false; message: string };
type PollStateJson = { id?: unknown; messageId?: unknown; question?: unknown; allowMultiple?: unknown; closesAt?: unknown; closedAt?: unknown; createdAt?: unknown; options?: unknown };

function mapPollState(value: unknown): PollData | null {
  if (!value || typeof value !== "object") return null;
  const row = value as PollStateJson;
  if (typeof row.id !== "string" || typeof row.messageId !== "string" || typeof row.question !== "string" || typeof row.createdAt !== "string" || !Array.isArray(row.options)) return null;
  const options: PollOption[] = row.options.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const option = item as Record<string, unknown>;
    if (typeof option.id !== "string" || typeof option.text !== "string" || typeof option.position !== "number" || typeof option.voteCount !== "number") return [];
    return [{ id: option.id, text: option.text, position: option.position, voteCount: Math.max(0, option.voteCount), votedByCurrentUser: option.votedByCurrentUser === true }];
  });
  return { id: row.id, messageId: row.messageId, question: row.question, allowMultiple: row.allowMultiple === true, closesAt: typeof row.closesAt === "string" ? row.closesAt : undefined, closedAt: typeof row.closedAt === "string" ? row.closedAt : undefined, createdAt: row.createdAt, options };
}

function validateDraft(input: CreatePollDraft): { question: string; options: string[]; closesAt?: string } | null {
  const question = input.question.trim().slice(0, 240);
  const options = input.options.map((item) => item.trim().slice(0, 100)).filter(Boolean).slice(0, 10);
  if (!question || options.length < 2 || new Set(options.map((item) => item.toLowerCase())).size !== options.length) return null;
  if (input.closesAt && (!Number.isFinite(Date.parse(input.closesAt)) || Date.parse(input.closesAt) <= Date.now())) return null;
  return { question, options, closesAt: input.closesAt };
}

export const pollService = {
  async create(input: CreatePollDraft & { messageId: string }): Promise<Result<PollData>> {
    const draft = validateDraft(input);
    if (!draft) return { ok: false, message: "A poll needs a question, two unique options, and a future close time." };
    if (dataSourceService.getStatus().isMock) {
      const id = `poll-${crypto.randomUUID()}`;
      return { ok: true, data: { id, messageId: input.messageId, question: draft.question, allowMultiple: input.allowMultiple, closesAt: draft.closesAt, createdAt: new Date().toISOString(), options: draft.options.map((text, position) => ({ id: `${id}-option-${position}`, text, position, voteCount: 0 })) } };
    }
    const client = getSupabaseClient();
    if (!client) return { ok: false, message: "Poll creation is unavailable." };
    const result = await client.rpc("create_poll_atomic", { target_message_id: input.messageId, poll_question: draft.question, option_texts: draft.options, allow_multiple_choices: input.allowMultiple, poll_closes_at: draft.closesAt ?? null });
    const poll = mapPollState(result.data);
    return result.error || !poll ? { ok: false, message: "Picom could not create this poll." } : { ok: true, data: poll };
  },
  async fetch(pollId: string): Promise<Result<PollData>> {
    const client = getSupabaseClient();
    if (!client) return { ok: false, message: "Poll results are unavailable." };
    const result = await client.rpc("get_poll_state", { target_poll_id: pollId });
    const poll = mapPollState(result.data);
    return result.error || !poll ? { ok: false, message: "Could not refresh poll results." } : { ok: true, data: poll };
  },
  async toggleVote(poll: PollData, optionId: string, userId: string): Promise<Result<PollData>> {
    const option = poll.options.find((item) => item.id === optionId);
    if (!option) return { ok: false, message: "Poll option not found." };
    if (poll.closedAt || (poll.closesAt && Date.parse(poll.closesAt) <= Date.now())) return { ok: false, message: "This poll is closed." };
    const nextOptions = poll.options.map((item) => {
      if (item.id === optionId) return { ...item, votedByCurrentUser: !item.votedByCurrentUser, voteCount: Math.max(0, item.voteCount + (item.votedByCurrentUser ? -1 : 1)) };
      if (!poll.allowMultiple && item.votedByCurrentUser) return { ...item, votedByCurrentUser: false, voteCount: Math.max(0, item.voteCount - 1) };
      return item;
    });
    if (dataSourceService.getStatus().isMock) return { ok: true, data: { ...poll, options: nextOptions } };
    const client = getSupabaseClient();
    if (!client) return { ok: false, message: "Voting is unavailable." };
    const auth = await client.auth.getUser();
    if (auth.data.user?.id !== userId) return { ok: false, message: "Sign in again before voting." };
    const result = await client.rpc("toggle_poll_vote", { target_poll_id: poll.id, target_option_id: optionId });
    const updated = mapPollState(result.data);
    return result.error || !updated ? { ok: false, message: "Picom could not update your vote." } : { ok: true, data: updated };
  },
  async close(poll: PollData): Promise<Result<PollData>> {
    if (poll.closedAt) return { ok: true, data: poll };
    if (dataSourceService.getStatus().isMock) return { ok: true, data: { ...poll, closedAt: new Date().toISOString() } };
    const client = getSupabaseClient();
    if (!client) return { ok: false, message: "Poll closing is unavailable." };
    const result = await client.rpc("close_poll", { target_poll_id: poll.id });
    const updated = mapPollState(result.data);
    return result.error || !updated ? { ok: false, message: "You cannot close this poll." } : { ok: true, data: updated };
  },
  subscribe(pollId: string, onUpdate: (poll: PollData) => void): () => void {
    if (dataSourceService.getStatus().isMock) return () => undefined;
    const client = getSupabaseClient();
    if (!client) return () => undefined;
    const refresh = () => { void this.fetch(pollId).then((result) => { if (result.ok) onUpdate(result.data); }); };
    const channel: RealtimeChannel = client.channel(`poll:${pollId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "poll_votes", filter: `poll_id=eq.${pollId}` }, refresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "polls", filter: `id=eq.${pollId}` }, refresh)
      .subscribe();
    return () => { void client.removeChannel(channel); };
  },
};
