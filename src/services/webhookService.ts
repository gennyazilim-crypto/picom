import type { CreatedWebhook, WebhookRecord } from "../types/webhooks";
import { appConfig } from "../config/appConfig";
import { auditLogService } from "./auditLogService";
import { dataSourceService } from "./dataSourceService";
import { getSupabaseClient } from "./supabase/supabaseClient";

type Result<T> = { ok: true; data: T } | { ok: false; message: string };
type StoredWebhook = WebhookRecord & { tokenHash: string };
type WebhookRpcRow = { webhook_id: string; community_id: string; channel_id: string; webhook_name: string; avatar_url: string | null; created_by: string; revoked_at: string | null; created_at: string; updated_at: string; token_once?: string };
const STORAGE_KEY = "picom.channelWebhooks.v1";

function readLocal(): StoredWebhook[] { try { const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as StoredWebhook[]; return Array.isArray(value) ? value : []; } catch { return []; } }
function writeLocal(records: StoredWebhook[]): void { try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); } catch { /* restricted fallback */ } }
function randomToken(): string { const bytes = crypto.getRandomValues(new Uint8Array(32)); return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join(""); }
async function hashToken(token: string): Promise<string> { const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)); return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join(""); }
function buildEndpointUrl(id: string): string { const base = appConfig.supabase.url.replace(/\/$/, "") || "http://127.0.0.1:54321"; return `${base}/functions/v1/webhook-message?id=${encodeURIComponent(id)}`; }
function safeRecord(record: StoredWebhook): WebhookRecord { const { tokenHash: _tokenHash, ...safe } = record; return safe; }
function mapRpcRow(row: WebhookRpcRow): WebhookRecord { return { id: row.webhook_id, communityId: row.community_id, channelId: row.channel_id, name: row.webhook_name, avatarUrl: row.avatar_url ?? undefined, createdBy: row.created_by, revokedAt: row.revoked_at ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at }; }

export const webhookService = {
  async list(communityId: string): Promise<Result<WebhookRecord[]>> {
    if (dataSourceService.getStatus().isMock) return { ok: true, data: readLocal().filter((item) => item.communityId === communityId).map(safeRecord) };
    const client = getSupabaseClient(); if (!client) return { ok: false, message: "Webhook management is unavailable." };
    const { data, error } = await client.from("webhooks").select("id,community_id,channel_id,name,avatar_url,created_by,revoked_at,created_at,updated_at").eq("community_id", communityId).order("created_at", { ascending: false });
    return error ? { ok: false, message: "Picom could not load channel webhooks." } : { ok: true, data: (data ?? []).map((row) => ({ id: row.id, communityId: row.community_id, channelId: row.channel_id, name: row.name, avatarUrl: row.avatar_url ?? undefined, createdBy: row.created_by, revokedAt: row.revoked_at ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at })) };
  },

  async create(input: { communityId: string; channelId: string; name: string; avatarUrl?: string; createdBy: string; canManage: boolean }): Promise<Result<CreatedWebhook>> {
    const name = input.name.trim().slice(0, 80); if (!input.canManage) return { ok: false, message: "You do not have permission to manage webhooks." }; if (!name || !input.channelId) return { ok: false, message: "Webhook name and channel are required." };
    if (dataSourceService.getStatus().isMock) {
      const token = randomToken(); const tokenHash = await hashToken(token); const now = new Date().toISOString();
      const stored: StoredWebhook = { id: `webhook-${crypto.randomUUID()}`, communityId: input.communityId, channelId: input.channelId, name, avatarUrl: input.avatarUrl?.trim() || undefined, createdBy: input.createdBy, createdAt: now, updatedAt: now, tokenHash };
      writeLocal([stored, ...readLocal()]); await auditLogService.append({ communityId: input.communityId, actorId: input.createdBy, actionType: "webhook_create", targetType: "webhook", targetId: stored.id, reason: `Webhook created for channel ${input.channelId}` });
      return { ok: true, data: { webhook: safeRecord(stored), endpointUrl: buildEndpointUrl(stored.id), tokenOnce: token } };
    }
    const client = getSupabaseClient(); if (!client) return { ok: false, message: "Webhook management is unavailable." };
    const { data, error } = await client.rpc("create_channel_webhook", { target_community_id: input.communityId, target_channel_id: input.channelId, target_webhook_name: name, webhook_avatar_url: input.avatarUrl?.trim() || null });
    const row = Array.isArray(data) ? data[0] as WebhookRpcRow | undefined : undefined;
    if (error || !row?.token_once) return { ok: false, message: "Picom could not create this webhook." };
    const webhook = mapRpcRow(row);
    return { ok: true, data: { webhook, endpointUrl: buildEndpointUrl(webhook.id), tokenOnce: row.token_once } };
  },

  async revoke(webhook: WebhookRecord, canManage: boolean): Promise<Result<WebhookRecord>> {
    if (!canManage) return { ok: false, message: "You do not have permission to manage webhooks." };
    if (dataSourceService.getStatus().isMock) {
      const records = readLocal(); const stored = records.find((item) => item.id === webhook.id); if (!stored) return { ok: false, message: "Webhook not found." };
      const revokedAt = new Date().toISOString(); const revoked = { ...stored, revokedAt, updatedAt: revokedAt }; writeLocal(records.map((item) => item.id === webhook.id ? revoked : item));
      await auditLogService.append({ communityId: webhook.communityId, actorId: webhook.createdBy, actionType: "webhook_revoke", targetType: "webhook", targetId: webhook.id, reason: "Webhook revoked" }); return { ok: true, data: safeRecord(revoked) };
    }
    const client = getSupabaseClient(); if (!client) return { ok: false, message: "Webhook management is unavailable." };
    const { data, error } = await client.rpc("revoke_channel_webhook", { target_webhook_id: webhook.id });
    const row = Array.isArray(data) ? data[0] as WebhookRpcRow | undefined : undefined;
    return error || !row ? { ok: false, message: "Picom could not revoke this webhook." } : { ok: true, data: mapRpcRow(row) };
  },
};
