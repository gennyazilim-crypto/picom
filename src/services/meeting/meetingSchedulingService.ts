import { getApiCompatibilityRequestHeaders } from "../../config/apiCompatibility";
import type {
  CreateMeetingInviteInput,
  CreatedMeetingInvite,
  MeetingInviteSummary,
  MeetingInviteValidation,
  MeetingJoinPreview,
  MeetingScheduleInput,
  MeetingScheduleSummary,
  MeetingSchedulingResult,
} from "../../types/meetingScheduling";
import { dataSourceService } from "../dataSourceService";
import type { Json } from "../supabase/database.types";
import { getSupabaseClient } from "../supabase/supabaseClient";

type StoredMockInvite = MeetingInviteSummary & { tokenHash: string };
const mockInvites = new Map<string, StoredMockInvite>();
const safeLinkSegment = /^[a-zA-Z0-9_-]{1,128}$/;

function failure<T>(code: string, message: string): MeetingSchedulingResult<T> {
  return { ok: false, error: { code, message } };
}

function randomInviteSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function buildInviteDeepLink(input: CreateMeetingInviteInput, secret: string): string {
  const community = encodeURIComponent(input.communityId);
  const room = encodeURIComponent(input.roomId);
  const channelPath = input.channelId ? `/channel/${encodeURIComponent(input.channelId)}/room/${room}` : `/room/${room}`;
  const sessionPath = input.sessionId ? `/session/${encodeURIComponent(input.sessionId)}` : "";
  return `picom://meeting/${community}${channelPath}${sessionPath}?invite=${secret}`;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function stringValue(row: Record<string, unknown>, key: string): string {
  return typeof row[key] === "string" ? row[key] as string : "";
}

function mapInvite(value: unknown): MeetingInviteSummary | null {
  const row = asRecord(value);
  if (!row) return null;
  const role = stringValue(row, "role") as MeetingInviteSummary["role"];
  const status = stringValue(row, "status") as MeetingInviteSummary["status"];
  const id = stringValue(row, "id");
  const roomId = stringValue(row, "roomId");
  const expiresAt = stringValue(row, "expiresAt");
  if (!id || !roomId || !expiresAt || !["host", "cohost", "speaker", "participant", "viewer", "guest"].includes(role)) return null;
  if (!["active", "accepted", "declined", "revoked", "expired"].includes(status)) return null;
  return {
    id,
    roomId,
    sessionId: typeof row.sessionId === "string" ? row.sessionId : null,
    invitedUserId: typeof row.invitedUserId === "string" ? row.invitedUserId : null,
    invitedByUserId: stringValue(row, "invitedByUserId"),
    role,
    status,
    tokenHint: stringValue(row, "tokenHint"),
    maxUses: Number(row.maxUses) || 1,
    useCount: Number(row.useCount) || 0,
    createdAt: stringValue(row, "createdAt") || new Date().toISOString(),
    expiresAt,
    lastUsedAt: typeof row.lastUsedAt === "string" ? row.lastUsedAt : null,
    revokedAt: typeof row.revokedAt === "string" ? row.revokedAt : null,
  };
}

function mapSchedule(value: unknown): MeetingScheduleSummary | null {
  const row = asRecord(value);
  if (!row) return null;
  const reminder = asRecord(row.reminderPolicy) ?? {};
  const result: MeetingScheduleSummary = {
    roomId: stringValue(row, "roomId"),
    eventId: stringValue(row, "eventId"),
    communityId: stringValue(row, "communityId"),
    scheduledFor: stringValue(row, "scheduledFor"),
    scheduledEndAt: stringValue(row, "scheduledEndAt"),
    hostUserId: stringValue(row, "hostUserId"),
    cohostUserIds: Array.isArray(row.cohostUserIds) ? row.cohostUserIds.filter((item): item is string => typeof item === "string") : [],
    reminderPolicy: {
      enabled: reminder.enabled === true,
      minutesBefore: Array.isArray(reminder.minutesBefore) ? reminder.minutesBefore.filter((item): item is number => typeof item === "number") : [],
    },
  };
  return result.roomId && result.eventId && result.scheduledFor && result.scheduledEndAt ? result : null;
}

function mapInviteValidation(value: unknown): MeetingInviteValidation | undefined {
  const row = asRecord(value);
  if (!row || typeof row.valid !== "boolean") return undefined;
  const role = typeof row.role === "string" && ["host", "cohost", "speaker", "participant", "viewer", "guest"].includes(row.role) ? row.role as MeetingInviteValidation["role"] : undefined;
  return {
    valid: row.valid,
    code: typeof row.code === "string" ? row.code.slice(0, 80) : "INVITE_INVALID",
    roomId: typeof row.roomId === "string" ? row.roomId : undefined,
    sessionId: typeof row.sessionId === "string" ? row.sessionId : null,
    role,
    expiresAt: typeof row.expiresAt === "string" ? row.expiresAt : null,
    alreadyRedeemed: row.alreadyRedeemed === true,
    usesRemaining: typeof row.usesRemaining === "number" ? Math.max(0, Math.floor(row.usesRemaining)) : undefined,
  };
}

export function mapMeetingJoinPreview(value: unknown): MeetingJoinPreview | null {
  const row = asRecord(value);
  if (!row || typeof row.roomId !== "string" || typeof row.canJoin !== "boolean" || typeof row.reason !== "string") return null;
  const mode = typeof row.mode === "string" && ["voice", "meeting", "stage"].includes(row.mode) ? row.mode as MeetingJoinPreview["mode"] : undefined;
  const status = typeof row.status === "string" && ["scheduled", "open", "live", "ended", "cancelled", "locked"].includes(row.status) ? row.status as MeetingJoinPreview["status"] : undefined;
  const joinPolicy = typeof row.joinPolicy === "string" && ["open", "members", "invite_only", "approval_required"].includes(row.joinPolicy) ? row.joinPolicy as MeetingJoinPreview["joinPolicy"] : undefined;
  const disposition = typeof row.disposition === "string" && ["direct", "waiting", "denied"].includes(row.disposition) ? row.disposition as MeetingJoinPreview["disposition"] : undefined;
  const capabilities = asRecord(row.capabilities);
  return {
    roomId: row.roomId,
    sessionId: typeof row.sessionId === "string" ? row.sessionId : null,
    communityId: typeof row.communityId === "string" ? row.communityId : undefined,
    communityName: typeof row.communityName === "string" ? row.communityName.slice(0, 120) : undefined,
    roomTitle: typeof row.roomTitle === "string" ? row.roomTitle.slice(0, 120) : undefined,
    hostName: typeof row.hostName === "string" ? row.hostName.slice(0, 120) : undefined,
    mode, status, joinPolicy,
    waitingRoomEnabled: row.waitingRoomEnabled === true,
    capabilities: capabilities ? Object.fromEntries(Object.entries(capabilities).filter(([, enabled]) => typeof enabled === "boolean")) as Record<string, boolean> : undefined,
    scheduledFor: typeof row.scheduledFor === "string" ? row.scheduledFor : null,
    scheduledEndAt: typeof row.scheduledEndAt === "string" ? row.scheduledEndAt : null,
    canJoin: row.canJoin,
    disposition,
    reason: row.reason.slice(0, 80),
    invite: mapInviteValidation(row.invite),
  };
}

function normalizeSchedule(input: MeetingScheduleInput): MeetingScheduleInput | null {
  const start = Date.parse(input.scheduledFor);
  const end = Date.parse(input.scheduledEndAt);
  if (!input.roomId || !Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 86_400_000) return null;
  const minutes = input.reminderPolicy?.minutesBefore ?? [15];
  if (minutes.some((value) => !Number.isInteger(value) || value < 0 || value > 10_080)) return null;
  return { ...input, cohostUserIds: [...new Set(input.cohostUserIds ?? [])], reminderPolicy: input.reminderPolicy ?? { enabled: false, minutesBefore: [15] } };
}

function mockValidation(invite: StoredMockInvite | undefined, consume: boolean): MeetingInviteValidation {
  if (!invite) return { valid: false, code: "INVITE_INVALID" };
  if (invite.revokedAt || invite.status === "revoked") return { valid: false, code: "INVITE_REVOKED" };
  if (Date.parse(invite.expiresAt) <= Date.now()) return { valid: false, code: "INVITE_EXPIRED" };
  if (invite.useCount >= invite.maxUses) return { valid: false, code: "INVITE_EXHAUSTED" };
  if (consume) mockInvites.set(invite.tokenHash, { ...invite, useCount: invite.useCount + 1, lastUsedAt: new Date().toISOString(), status: invite.useCount + 1 >= invite.maxUses ? "accepted" : "active" });
  return { valid: true, code: "INVITE_VALID", roomId: invite.roomId, sessionId: invite.sessionId, role: invite.role, expiresAt: invite.expiresAt, alreadyRedeemed: consume, usesRemaining: Math.max(invite.maxUses - invite.useCount - (consume ? 1 : 0), 0) };
}

export const meetingSchedulingService = {
  async schedule(input: MeetingScheduleInput): Promise<MeetingSchedulingResult<MeetingScheduleSummary>> {
    const normalized = normalizeSchedule(input);
    if (!normalized) return failure("MEETING_SCHEDULE_INVALID", "Choose a valid meeting start and end time of no more than 24 hours.");
    if (dataSourceService.getStatus().isMock) {
      return { ok: true, data: { roomId: normalized.roomId, eventId: normalized.eventId ?? `mock-event-${normalized.roomId}`, communityId: "mock-community", scheduledFor: normalized.scheduledFor, scheduledEndAt: normalized.scheduledEndAt, hostUserId: normalized.hostUserId ?? "mock-host", cohostUserIds: normalized.cohostUserIds ?? [], reminderPolicy: normalized.reminderPolicy ?? { enabled: false, minutesBefore: [15] } } };
    }
    const client = getSupabaseClient();
    if (!client) return failure("DATA_SOURCE_NOT_CONFIGURED", "Supabase is not configured.");
    const { data, error } = await client.rpc("schedule_meeting_room", { target_room_id: normalized.roomId, target_scheduled_for: normalized.scheduledFor, target_scheduled_end_at: normalized.scheduledEndAt, target_host_user_id: normalized.hostUserId ?? null, target_cohost_user_ids: [...(normalized.cohostUserIds ?? [])], target_event_id: normalized.eventId ?? null, target_reminder_policy: normalized.reminderPolicy as unknown as Json });
    const mapped = mapSchedule(data);
    return error || !mapped ? failure("MEETING_SCHEDULE_FAILED", "Picom could not schedule this meeting.") : { ok: true, data: mapped };
  },

  async createInvite(input: CreateMeetingInviteInput): Promise<MeetingSchedulingResult<CreatedMeetingInvite>> {
    const maxUses = input.maxUses ?? 1;
    const expiresAt = input.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const expiry = Date.parse(expiresAt);
    if (!safeLinkSegment.test(input.roomId) || !safeLinkSegment.test(input.communityId) || (input.channelId && !safeLinkSegment.test(input.channelId)) || (input.sessionId && !safeLinkSegment.test(input.sessionId)) || maxUses < 1 || maxUses > 100 || expiry <= Date.now() + 5 * 60 * 1000 || expiry > Date.now() + 30 * 24 * 60 * 60 * 1000) return failure("MEETING_INVITE_INVALID", "Choose a valid meeting, invite expiry, and use limit.");
    const secret = randomInviteSecret();
    const tokenHash = await sha256(secret);
    const tokenHint = secret.slice(-8);
    const role = input.guestPolicy === "signed_in_guest" ? "guest" : input.role ?? "participant";
    if (dataSourceService.getStatus().isMock) {
      const invite: MeetingInviteSummary = { id: crypto.randomUUID(), roomId: input.roomId, sessionId: input.sessionId ?? null, invitedUserId: input.invitedUserId ?? null, invitedByUserId: "mock-current-user", role, status: "active", tokenHint, maxUses, useCount: 0, createdAt: new Date().toISOString(), expiresAt, lastUsedAt: null, revokedAt: null };
      mockInvites.set(tokenHash, { ...invite, tokenHash });
      return { ok: true, data: { invite, secret, deepLink: buildInviteDeepLink(input, secret) } };
    }
    const client = getSupabaseClient();
    if (!client) return failure("DATA_SOURCE_NOT_CONFIGURED", "Supabase is not configured.");
    const { data, error } = await client.rpc("create_meeting_invite", { target_room_id: input.roomId, target_token_hash: tokenHash, target_token_hint: tokenHint, target_role: role, target_invited_user_id: input.invitedUserId ?? null, target_session_id: input.sessionId ?? null, target_expires_at: expiresAt, target_max_uses: maxUses });
    const invite = mapInvite(data);
    return error || !invite ? failure("MEETING_INVITE_CREATE_FAILED", "Picom could not create this meeting invite.") : { ok: true, data: { invite, secret, deepLink: buildInviteDeepLink(input, secret) } };
  },

  async regenerateInvite(inviteId: string, input: CreateMeetingInviteInput): Promise<MeetingSchedulingResult<CreatedMeetingInvite>> {
    const maxUses = input.maxUses ?? 1;
    const expiresAt = input.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const expiry = Date.parse(expiresAt);
    if (!inviteId || !safeLinkSegment.test(input.roomId) || !safeLinkSegment.test(input.communityId) || maxUses < 1 || maxUses > 100 || expiry <= Date.now() + 5 * 60 * 1000 || expiry > Date.now() + 30 * 24 * 60 * 60 * 1000) return failure("MEETING_INVITE_INVALID", "Choose a valid meeting, invite expiry, and use limit.");
    const secret = randomInviteSecret(), tokenHash = await sha256(secret), tokenHint = secret.slice(-8);
    const role = input.guestPolicy === "signed_in_guest" ? "guest" : input.role ?? "participant";
    if (dataSourceService.getStatus().isMock) {
      const existing = [...mockInvites.values()].find((item) => item.id === inviteId && item.roomId === input.roomId);
      if (!existing || existing.status === "revoked") return failure("MEETING_INVITE_NOT_FOUND", "This meeting invite is unavailable.");
      const now = new Date().toISOString();
      mockInvites.set(existing.tokenHash, { ...existing, status: "revoked", revokedAt: now });
      const invite: MeetingInviteSummary = { id: crypto.randomUUID(), roomId: input.roomId, sessionId: input.sessionId ?? null, invitedUserId: input.invitedUserId ?? null, invitedByUserId: "mock-current-user", role, status: "active", tokenHint, maxUses, useCount: 0, createdAt: now, expiresAt, lastUsedAt: null, revokedAt: null };
      mockInvites.set(tokenHash, { ...invite, tokenHash });
      return { ok: true, data: { invite, secret, deepLink: buildInviteDeepLink(input, secret) } };
    }
    const client = getSupabaseClient();
    if (!client) return failure("DATA_SOURCE_NOT_CONFIGURED", "Supabase is not configured.");
    const { data, error } = await client.rpc("regenerate_meeting_invite", { target_invite_id: inviteId, target_token_hash: tokenHash, target_token_hint: tokenHint, target_role: role, target_invited_user_id: input.invitedUserId ?? null, target_session_id: input.sessionId ?? null, target_expires_at: expiresAt, target_max_uses: maxUses });
    const invite = mapInvite(data);
    return error || !invite ? failure("MEETING_INVITE_REGENERATE_FAILED", "Picom could not regenerate this meeting invite.") : { ok: true, data: { invite, secret, deepLink: buildInviteDeepLink(input, secret) } };
  },

  async revokeInvite(inviteId: string): Promise<MeetingSchedulingResult<MeetingInviteSummary>> {
    if (dataSourceService.getStatus().isMock) {
      const stored = [...mockInvites.values()].find((item) => item.id === inviteId);
      if (!stored) return failure("MEETING_INVITE_NOT_FOUND", "This meeting invite is unavailable.");
      const revoked = { ...stored, status: "revoked" as const, revokedAt: new Date().toISOString() };
      mockInvites.set(stored.tokenHash, revoked);
      const { tokenHash: _tokenHash, ...invite } = revoked;
      return { ok: true, data: invite };
    }
    const client = getSupabaseClient();
    if (!client) return failure("DATA_SOURCE_NOT_CONFIGURED", "Supabase is not configured.");
    const { data, error } = await client.rpc("revoke_meeting_invite", { target_invite_id: inviteId });
    const invite = mapInvite(data);
    return error || !invite ? failure("MEETING_INVITE_REVOKE_FAILED", "Picom could not revoke this meeting invite.") : { ok: true, data: invite };
  },

  async listInvites(roomId: string): Promise<MeetingSchedulingResult<readonly MeetingInviteSummary[]>> {
    if (dataSourceService.getStatus().isMock) return { ok: true, data: [...mockInvites.values()].filter((item) => item.roomId === roomId).map(({ tokenHash: _tokenHash, ...invite }) => invite) };
    const client = getSupabaseClient();
    if (!client) return failure("DATA_SOURCE_NOT_CONFIGURED", "Supabase is not configured.");
    const { data, error } = await client.rpc("list_meeting_invites", { target_room_id: roomId });
    const values = Array.isArray(data) ? data : [];
    const invites = values.map(mapInvite).filter((item): item is MeetingInviteSummary => Boolean(item));
    return error ? failure("MEETING_INVITE_LIST_FAILED", "Picom could not load meeting invites.") : { ok: true, data: invites };
  },

  async validateInvite(roomId: string, secret: string, consume = false): Promise<MeetingSchedulingResult<MeetingInviteValidation>> {
    if (!/^[0-9a-f]{64}$/i.test(secret)) return failure("INVITE_INVALID", "This meeting invite is invalid.");
    const tokenHash = await sha256(secret.toLowerCase());
    if (dataSourceService.getStatus().isMock) return { ok: true, data: mockValidation(mockInvites.get(tokenHash), consume) };
    const client = getSupabaseClient();
    if (!client) return failure("DATA_SOURCE_NOT_CONFIGURED", "Supabase is not configured.");
    const { data, error } = await client.functions.invoke<MeetingInviteValidation>("meeting-join", { headers: getApiCompatibilityRequestHeaders(), body: { action: consume ? "redeem" : "validate", roomId, inviteToken: secret } });
    return error || !data || typeof data.valid !== "boolean" ? failure("MEETING_INVITE_VALIDATION_FAILED", "Picom could not validate this meeting invite.") : { ok: true, data };
  },

  async getJoinPreview(roomId: string, secret?: string): Promise<MeetingSchedulingResult<MeetingJoinPreview>> {
    const client = dataSourceService.getStatus().isMock ? null : getSupabaseClient();
    if (dataSourceService.getStatus().isMock) {
      const validation = secret ? mockValidation(mockInvites.get(await sha256(secret.toLowerCase())), false) : undefined;
      const canJoin = !secret || validation?.valid === true;
      return { ok: true, data: { roomId, sessionId: validation?.sessionId ?? `mock-session-${roomId}`, communityId: "community-aurora", communityName: "Aurora Studio", roomTitle: "Picom workspace review", hostName: "Mira Chen", mode: "meeting", status: "live", joinPolicy: secret ? "invite_only" : "members", waitingRoomEnabled: true, capabilities: { canPublishAudio: true, canPublishVideo: true, canShareScreen: true, canSendChat: true }, canJoin, disposition: canJoin ? "waiting" : "denied", reason: canJoin ? "allowed" : validation?.code ?? "invite_invalid", invite: validation } };
    }
    if (!client) return failure("DATA_SOURCE_NOT_CONFIGURED", "Supabase is not configured.");
    const { data, error } = await client.functions.invoke<MeetingJoinPreview>("meeting-join", { headers: getApiCompatibilityRequestHeaders(), body: { action: "preview", roomId, ...(secret ? { inviteToken: secret } : {}) } });
    const preview = mapMeetingJoinPreview(data);
    return error || !preview ? failure("MEETING_JOIN_PREVIEW_FAILED", "Picom could not load the meeting join preview.") : { ok: true, data: preview };
  },
};
