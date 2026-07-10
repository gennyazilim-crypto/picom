import type { AppendAuditLogInput, AuditLogRecord } from "../types/auditLog";
import { dataSourceService } from "./dataSourceService";
import { getSupabaseClient } from "./supabase/supabaseClient";

const STORAGE_KEY = "picom.communityAuditLog.v1";
type Result<T> = { ok: true; data: T } | { ok: false; message: string };
type AuditRow = { id: string; community_id: string; actor_id: string; action_type: string; target_type: string; target_id: string | null; reason: string | null; created_at: string };
function readLocal(): AuditLogRecord[] { try { const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as AuditLogRecord[]; return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
function writeLocal(records: AuditLogRecord[]): void { try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, 1000))); } catch { /* restricted fallback */ } }
function mapRow(row: AuditRow): AuditLogRecord { return { id: row.id, communityId: row.community_id, actorId: row.actor_id, actionType: row.action_type as AuditLogRecord["actionType"], targetType: row.target_type, targetId: row.target_id ?? undefined, reason: row.reason ?? undefined, createdAt: row.created_at }; }

export const auditLogService = {
  async append(input: AppendAuditLogInput): Promise<Result<AuditLogRecord>> {
    if (dataSourceService.getStatus().isMock) { const record: AuditLogRecord = { ...input, id: `audit-${crypto.randomUUID()}`, actorId: input.actorId ?? "mock-current-user", createdAt: new Date().toISOString() }; writeLocal([record, ...readLocal()]); return { ok: true, data: record }; }
    const client = getSupabaseClient(); if (!client) return { ok: false, message: "Audit logging is unavailable." };
    const { data, error } = await client.rpc("append_community_audit_log", { target_community_id: input.communityId, event_action_type: input.actionType, event_target_type: input.targetType, event_target_id: input.targetId ?? null, event_reason: input.reason?.slice(0, 500) ?? null });
    if (error || !data) return { ok: false, message: "Audit event could not be recorded." };
    const { data: actor } = await client.auth.getUser();
    return { ok: true, data: { id: data, communityId: input.communityId, actorId: actor.user?.id ?? "authenticated-user", actionType: input.actionType, targetType: input.targetType, targetId: input.targetId, reason: input.reason, createdAt: new Date().toISOString() } };
  },
  async list(communityId: string, canView: boolean): Promise<Result<AuditLogRecord[]>> {
    if (!canView) return { ok: false, message: "You do not have permission to view the audit log." };
    if (dataSourceService.getStatus().isMock) return { ok: true, data: readLocal().filter((item) => item.communityId === communityId) };
    const client = getSupabaseClient(); if (!client) return { ok: false, message: "Audit log is unavailable." };
    const { data, error } = await client.from("audit_log").select("id,community_id,actor_id,action_type,target_type,target_id,reason,created_at").eq("community_id", communityId).order("created_at", { ascending: false }).limit(500);
    return error ? { ok: false, message: "Picom could not load the audit log." } : { ok: true, data: (data ?? []).map(mapRow) };
  },
  exportJson(records: AuditLogRecord[]): string { return JSON.stringify({ exportedAt: new Date().toISOString(), records }, null, 2); },
};
