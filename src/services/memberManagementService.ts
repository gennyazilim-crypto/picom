import type { CommunityModerationState, MemberModerationAction, MemberModerationResult } from "../types/memberModeration";
import { auditLogService } from "./auditLogService";
import { dataSourceService } from "./dataSourceService";
import { getSupabaseClient, getSupabaseClientStatus } from "./supabase/supabaseClient";

export type ModerateMemberInput = Readonly<{
  communityId: string;
  actorId: string;
  targetUserId: string;
  targetDisplayName: string;
  action: MemberModerationAction;
  reason: string;
  timeoutMinutes?: number;
}>;

type MemberManagementResult =
  | Readonly<{ ok: true; data: MemberModerationResult }>
  | Readonly<{ ok: false; code: "VALIDATION_ERROR" | "NOT_CONFIGURED" | "PERMISSION_DENIED" | "MEMBER_MODERATION_FAILED"; message: string }>;

type ModerationStateResult = Readonly<{ ok: true; data: CommunityModerationState[] }> | Readonly<{ ok: false; code: "NOT_CONFIGURED" | "PERMISSION_DENIED" | "MEMBER_MODERATION_FAILED"; message: string }>;
type ModerationStateRow = Readonly<{ record_type: "ban" | "timeout"; user_id: string; display_name: string; reason: string; actor_id: string; expires_at: string | null; created_at: string }>;
const mockModerationStates = new Map<string, CommunityModerationState[]>();

function validate(input: ModerateMemberInput): string | null {
  if (!input.communityId.trim() || !input.targetUserId.trim()) return "Community and target member are required.";
  if (input.actorId === input.targetUserId) return "You cannot moderate your own account.";
  if (input.reason.trim().length < 3 || input.reason.trim().length > 500) return "Reason must be between 3 and 500 characters.";
  if (input.action === "timeout" && (!input.timeoutMinutes || input.timeoutMinutes < 1 || input.timeoutMinutes > 10_080)) return "Choose a timeout between 1 minute and 7 days.";
  return null;
}

export const memberManagementService = {
  async listModerationStates(communityId: string, canManage: boolean): Promise<ModerationStateResult> {
    if (!canManage) return { ok: false, code: "PERMISSION_DENIED", message: "You do not have permission to inspect member restrictions." };
    if (dataSourceService.getStatus().isMock) return { ok: true, data: [...(mockModerationStates.get(communityId) ?? [])].filter((item) => item.recordType === "ban" || !item.expiresAt || Date.parse(item.expiresAt) > Date.now()) };
    const status = getSupabaseClientStatus(); const client = getSupabaseClient();
    if (!status.configured || !client) return { ok: false, code: "NOT_CONFIGURED", message: status.reason ?? "Supabase is not configured." };
    const rpcClient = client as unknown as { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };
    const { data, error } = await rpcClient.rpc("list_community_moderation_states", { target_community_id: communityId });
    if (error) return { ok: false, code: error.message.includes("PERMISSION_DENIED") ? "PERMISSION_DENIED" : "MEMBER_MODERATION_FAILED", message: error.message.includes("PERMISSION_DENIED") ? "You do not have permission to inspect member restrictions." : "Member restrictions could not be loaded." };
    return { ok: true, data: (Array.isArray(data) ? data : []).map((row) => row as ModerationStateRow).map((row) => ({ recordType: row.record_type, userId: row.user_id, displayName: row.display_name, reason: row.reason, actorId: row.actor_id, expiresAt: row.expires_at, createdAt: row.created_at })) };
  },

  async moderateMember(input: ModerateMemberInput): Promise<MemberManagementResult> {
    const validationMessage = validate(input);
    if (validationMessage) return { ok: false, code: "VALIDATION_ERROR", message: validationMessage };
    const reason = input.reason.trim();
    let result: MemberModerationResult;

    if (dataSourceService.getStatus().isMock) {
      const now = new Date().toISOString();
      const states = mockModerationStates.get(input.communityId) ?? [];
      const remaining = states.filter((item) => !(item.userId === input.targetUserId && ((input.action === "ban" || input.action === "unban") ? item.recordType === "ban" : (input.action === "timeout" || input.action === "untimeout") ? item.recordType === "timeout" : false)));
      if (input.action === "ban") remaining.push({ recordType: "ban", userId: input.targetUserId, displayName: input.targetDisplayName, reason, actorId: input.actorId, expiresAt: null, createdAt: now });
      if (input.action === "timeout") remaining.push({ recordType: "timeout", userId: input.targetUserId, displayName: input.targetDisplayName, reason, actorId: input.actorId, expiresAt: new Date(Date.now() + (input.timeoutMinutes ?? 60) * 60_000).toISOString(), createdAt: now });
      mockModerationStates.set(input.communityId, remaining);
      result = {
        action: input.action,
        targetUserId: input.targetUserId,
        timeoutUntil: input.action === "timeout" ? new Date(Date.now() + (input.timeoutMinutes ?? 60) * 60_000).toISOString() : null,
      };
    } else {
      const status = getSupabaseClientStatus();
      const client = getSupabaseClient();
      if (!status.configured || !client) return { ok: false, code: "NOT_CONFIGURED", message: status.reason ?? "Supabase is not configured." };
      const rpcClient = client as unknown as { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string; code?: string } | null }> };
      const { data, error } = await rpcClient.rpc("moderate_community_member", {
        target_community_id: input.communityId,
        target_user_id: input.targetUserId,
        moderation_action: input.action,
        moderation_reason: reason,
        timeout_minutes: input.action === "timeout" ? input.timeoutMinutes ?? 60 : null,
      });
      if (error || !data) {
        const permissionDenied = error?.message.includes("PERMISSION_DENIED") || error?.message.includes("ROLE_HIERARCHY");
        return { ok: false, code: permissionDenied ? "PERMISSION_DENIED" : "MEMBER_MODERATION_FAILED", message: permissionDenied ? "You cannot manage this member." : "The moderation action could not be completed." };
      }
      const payload = data as { action?: MemberModerationAction; targetUserId?: string; timeoutUntil?: string | null; target_user_id?: string; timeout_until?: string | null };
      result = { action: payload.action ?? input.action, targetUserId: payload.targetUserId ?? payload.target_user_id ?? input.targetUserId, timeoutUntil: payload.timeoutUntil ?? payload.timeout_until ?? null };
    }

    if (dataSourceService.getStatus().isMock) await auditLogService.append({ communityId: input.communityId, actorId: input.actorId, actionType: "moderation_action", targetType: "member", targetId: input.targetUserId, reason: `${input.action} ${input.targetDisplayName}: ${reason}` });
    return { ok: true, data: result };
  },
};
