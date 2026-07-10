import type { AppealStatus, ModerationAppeal, ReviewAppealInput, SubmitAppealInput } from "../types/appeals";
import { dataSourceService } from "./dataSourceService";
import { getSupabaseClient } from "./supabase/supabaseClient";
import { auditLogService } from "./auditLogService";

type AppealResult<T> = Readonly<{ ok: true; data: T } | { ok: false; message: string }>;
type AppealRow = { id: string; community_id: string; affected_user_id: string; moderation_action_id: string; reason: string; status: AppealStatus; decision_note: string | null; reviewed_by: string | null; reviewed_at: string | null; created_at: string; updated_at: string };

const SELECT_FIELDS = "id,community_id,affected_user_id,moderation_action_id,reason,status,decision_note,reviewed_by,reviewed_at,created_at,updated_at";
const APPEAL_SECRET_PATTERN = /(bearer\s+)[a-z0-9._~+\/-]+|((?:password|token|secret|authorization|cookie|api[_-]?key)\s*[:=]\s*)[^,;\s]+/gi;
const localAppeals: ModerationAppeal[] = [];
const allowedTransitions: Record<AppealStatus, readonly AppealStatus[]> = { open: ["under_review", "accepted", "denied", "closed"], under_review: ["accepted", "denied", "closed"], accepted: ["closed"], denied: ["closed"], closed: [] };

function sanitizeAppealText(value: string | undefined, maxLength: number): string {
  return (value?.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(APPEAL_SECRET_PATTERN, (_match, bearerPrefix: string | undefined, keyPrefix: string | undefined) => `${bearerPrefix ?? keyPrefix ?? ""}[REDACTED]`).trim() ?? "").slice(0, maxLength);
}
function mapAppeal(row: AppealRow): ModerationAppeal { return { id: row.id, communityId: row.community_id, affectedUserId: row.affected_user_id, moderationActionId: row.moderation_action_id, reason: sanitizeAppealText(row.reason, 2000), status: row.status, decisionNote: row.decision_note ? sanitizeAppealText(row.decision_note, 1000) : undefined, reviewedById: row.reviewed_by ?? undefined, reviewedAt: row.reviewed_at ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at }; }
function cacheAppeal(appeal: ModerationAppeal): void { const index = localAppeals.findIndex((item) => item.id === appeal.id); if (index >= 0) localAppeals[index] = appeal; else localAppeals.unshift(appeal); }
export function canTransitionAppealStatus(from: AppealStatus, to: AppealStatus): boolean { return allowedTransitions[from].includes(to); }

export const appealService = {
  async submit(input: SubmitAppealInput): Promise<AppealResult<ModerationAppeal>> {
    const reason = sanitizeAppealText(input.reason, 2000);
    if (!input.communityId || !input.moderationActionId || input.affectedUserId !== input.currentUserId || reason.length < 10) return { ok: false, message: "Only the affected signed-in user can submit a valid appeal." };
    const now = new Date().toISOString();
    if (dataSourceService.getStatus().isMock) {
      if (localAppeals.some((item) => item.moderationActionId === input.moderationActionId && item.affectedUserId === input.affectedUserId && ["open", "under_review"].includes(item.status))) return { ok: false, message: "An active appeal already exists for this action." };
      const appeal: ModerationAppeal = { id: `mock-appeal-${crypto.randomUUID()}`, communityId: input.communityId, affectedUserId: input.affectedUserId, moderationActionId: input.moderationActionId, reason, status: "open", createdAt: now, updatedAt: now };
      cacheAppeal(appeal); return { ok: true, data: appeal };
    }
    const client = getSupabaseClient(); if (!client) return { ok: false, message: "Appeals are unavailable while the API is not configured." };
    const { data: authData } = await client.auth.getUser(); if (!authData.user || authData.user.id !== input.affectedUserId) return { ok: false, message: "Only the affected signed-in user can submit this appeal." };
    const { data, error } = await client.from("moderation_appeals").insert({ community_id: input.communityId, affected_user_id: authData.user.id, moderation_action_id: input.moderationActionId, reason, status: "open" }).select(SELECT_FIELDS).single();
    if (error || !data) return { ok: false, message: "Picom could not submit this appeal." };
    return { ok: true, data: mapAppeal(data) };
  },

  async listOwn(userId: string): Promise<AppealResult<ModerationAppeal[]>> {
    if (!userId) return { ok: false, message: "Sign in to view appeals." };
    if (dataSourceService.getStatus().isMock) return { ok: true, data: localAppeals.filter((item) => item.affectedUserId === userId).map((item) => ({ ...item })) };
    const client = getSupabaseClient(); if (!client) return { ok: false, message: "Appeals are unavailable." };
    const { data: authData } = await client.auth.getUser(); if (authData.user?.id !== userId) return { ok: false, message: "You can view only your own appeals." };
    const { data, error } = await client.from("moderation_appeals").select(SELECT_FIELDS).eq("affected_user_id", userId).order("created_at", { ascending: false }).limit(100);
    return error ? { ok: false, message: "Picom could not load your appeals." } : { ok: true, data: (data ?? []).map(mapAppeal) };
  },

  async listCommunity(communityId: string, canReview: boolean): Promise<AppealResult<ModerationAppeal[]>> {
    if (!canReview) return { ok: false, message: "You do not have permission to review appeals." };
    if (dataSourceService.getStatus().isMock) return { ok: true, data: localAppeals.filter((item) => item.communityId === communityId).map((item) => ({ ...item })) };
    const client = getSupabaseClient(); if (!client) return { ok: false, message: "The appeals queue is unavailable." };
    const { data, error } = await client.from("moderation_appeals").select(SELECT_FIELDS).eq("community_id", communityId).order("created_at", { ascending: false }).limit(100);
    return error ? { ok: false, message: "Picom could not load the appeals queue." } : { ok: true, data: (data ?? []).map(mapAppeal) };
  },

  async review(input: ReviewAppealInput): Promise<AppealResult<ModerationAppeal>> {
    if (!input.canReview) return { ok: false, message: "You do not have permission to review appeals." };
    const decisionNote = sanitizeAppealText(input.decisionNote, 1000);
    if (dataSourceService.getStatus().isMock) {
      const current = localAppeals.find((item) => item.id === input.appealId); if (!current) return { ok: false, message: "Appeal not found." };
      if (!canTransitionAppealStatus(current.status, input.status)) return { ok: false, message: "This appeal status transition is not allowed." };
      const now = new Date().toISOString(); const next: ModerationAppeal = { ...current, status: input.status, decisionNote: decisionNote || undefined, reviewedById: input.reviewerId ?? "mock-current-reviewer", reviewedAt: now, updatedAt: now }; cacheAppeal(next);
      await auditLogService.append({ communityId: next.communityId, actorId: next.reviewedById, actionType: "moderation_action", targetType: "appeal", targetId: next.id, reason: `Appeal marked ${next.status}` }); return { ok: true, data: next };
    }
    const client = getSupabaseClient(); if (!client) return { ok: false, message: "The appeals queue is unavailable." };
    const { data: authData } = await client.auth.getUser(); const reviewerId = input.reviewerId ?? authData.user?.id; if (!reviewerId) return { ok: false, message: "Sign in before reviewing appeals." };
    const { data, error } = await client.from("moderation_appeals").update({ status: input.status, decision_note: decisionNote || null, reviewed_by: reviewerId, updated_at: new Date().toISOString() }).eq("id", input.appealId).select(SELECT_FIELDS).single();
    if (error || !data) return { ok: false, message: "Picom could not update this appeal." };
    const next = mapAppeal(data); await auditLogService.append({ communityId: next.communityId, actionType: "moderation_action", targetType: "appeal", targetId: next.id, reason: `Appeal marked ${next.status}` }); return { ok: true, data: next };
  },

  canTransitionAppealStatus,
};
