import type { AppendAuditLogInput, AuditLogRecord } from "../types/auditLog";
import { dataSourceService } from "./dataSourceService";
import { getSupabaseClient } from "./supabase/supabaseClient";

const STORAGE_KEY = "picom.communityAuditLog.v1";
type Result<T> = { ok: true; data: T } | { ok: false; message: string };
type AuditRow = { id: string; community_id: string; actor_id: string; action_type: string; target_type: string; target_id: string | null; reason: string | null; created_at: string };
const AUDIT_SECRET_PATTERN = /(bearer\s+)[a-z0-9._~+\/-]+|((?:password|token|secret|authorization|cookie|api[_-]?key)\s*[:=]\s*)[^,;\s]+/gi;
function sanitizeAuditText(value: string | null | undefined, maxLength: number): string | undefined { const sanitized = value?.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(AUDIT_SECRET_PATTERN, (_match, bearerPrefix: string | undefined, keyPrefix: string | undefined) => `${bearerPrefix ?? keyPrefix ?? ""}[REDACTED]`).trim().slice(0, maxLength); return sanitized || undefined; }
function readLocal(): AuditLogRecord[] { try { const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as AuditLogRecord[]; return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
function writeLocal(records: AuditLogRecord[]): void { try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, 1000))); } catch { /* restricted fallback */ } }
function mapRow(row: AuditRow): AuditLogRecord { return { id: row.id, communityId: row.community_id, actorId: row.actor_id, actionType: row.action_type as AuditLogRecord["actionType"], targetType: sanitizeAuditText(row.target_type, 80) ?? "unknown", targetId: row.target_id ?? undefined, reason: sanitizeAuditText(row.reason, 500), createdAt: row.created_at }; }

export const auditLogService = {
  async append(input: AppendAuditLogInput): Promise<Result<AuditLogRecord>> {
    const targetType = sanitizeAuditText(input.targetType, 80) ?? "unknown"; const reason = sanitizeAuditText(input.reason, 500);
    if (dataSourceService.getStatus().isMock) { const record: AuditLogRecord = { ...input, targetType, reason, id: `audit-${crypto.randomUUID()}`, actorId: input.actorId ?? "mock-current-user", createdAt: new Date().toISOString() }; writeLocal([record, ...readLocal()]); return { ok: true, data: record }; }
    const client = getSupabaseClient(); if (!client) return { ok: false, message: "Audit logging is unavailable." };
    const { data, error } = await client.rpc("append_community_audit_log", { target_community_id: input.communityId, event_action_type: input.actionType, event_target_type: targetType, event_target_id: input.targetId ?? null, event_reason: reason ?? null });
    if (error || !data) return { ok: false, message: "Audit event could not be recorded." };
    const { data: actor } = await client.auth.getUser();
    return { ok: true, data: { id: data, communityId: input.communityId, actorId: actor.user?.id ?? "authenticated-user", actionType: input.actionType, targetType, targetId: input.targetId, reason, createdAt: new Date().toISOString() } };
  },
  async list(communityId: string, canView: boolean): Promise<Result<AuditLogRecord[]>> {
    if (!canView) return { ok: false, message: "You do not have permission to view the audit log." };
    if (dataSourceService.getStatus().isMock) return { ok: true, data: readLocal().filter((item) => item.communityId === communityId) };
    const client = getSupabaseClient(); if (!client) return { ok: false, message: "Audit log is unavailable." };
    const { data, error } = await client.from("audit_log").select("id,community_id,actor_id,action_type,target_type,target_id,reason,created_at").eq("community_id", communityId).order("created_at", { ascending: false }).limit(500);
    return error ? { ok: false, message: "Picom could not load the audit log." } : { ok: true, data: (data ?? []).map(mapRow) };
  },
  exportJson(records: AuditLogRecord[]): string { return JSON.stringify({ formatVersion: 1, exportedAt: new Date().toISOString(), records: records.slice(0, 5000).map((record) => ({ ...record, targetType: sanitizeAuditText(record.targetType, 80) ?? "unknown", reason: sanitizeAuditText(record.reason, 500) })) }, null, 2); },
};
