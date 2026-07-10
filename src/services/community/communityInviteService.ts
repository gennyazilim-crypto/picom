import type { Community, Member } from "../../types/community";
import { dataSourceService } from "../dataSourceService";
import { getSupabaseClient, getSupabaseClientStatus } from "../supabase/supabaseClient";
import { communityMembershipService } from "./communityMembershipService";

export type CommunityInvite = Readonly<{
  id: string;
  communityId: string;
  code: string;
  createdBy: string;
  maxUses: number | null;
  uses: number;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}>;

type InviteResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };
type MockInviteStore = { records: CommunityInvite[] };
const STORAGE_KEY = "picom:community-invites:v1";

function readMockStore(): MockInviteStore {
  if (typeof window === "undefined") return { records: [] };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<MockInviteStore>;
    return { records: Array.isArray(parsed.records) ? parsed.records : [] };
  } catch {
    return { records: [] };
  }
}

function writeMockStore(store: MockInviteStore): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function generateCode(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function normalizeCode(value: string): string {
  const trimmed = value.trim();
  const deepLinkMatch = /^picom:\/\/invite\/([a-zA-Z0-9_-]{8,64})\/?$/i.exec(trimmed);
  return deepLinkMatch?.[1] ?? trimmed;
}

function mapInvite(row: {
  id: string; community_id: string; code: string; created_by: string; max_uses: number | null; uses: number; expires_at: string | null; revoked_at: string | null; created_at: string;
}): CommunityInvite {
  return { id: row.id, communityId: row.community_id, code: row.code, createdBy: row.created_by, maxUses: row.max_uses, uses: row.uses, expiresAt: row.expires_at, revokedAt: row.revoked_at, createdAt: row.created_at };
}

function validateInvite(invite: CommunityInvite): InviteResult<CommunityInvite> {
  if (invite.revokedAt) return { ok: false, error: { code: "INVITE_REVOKED", message: "This invite has been revoked." } };
  if (invite.expiresAt && Date.parse(invite.expiresAt) <= Date.now()) return { ok: false, error: { code: "INVITE_EXPIRED", message: "This invite has expired." } };
  if (invite.maxUses !== null && invite.uses >= invite.maxUses) return { ok: false, error: { code: "INVITE_EXHAUSTED", message: "This invite has reached its use limit." } };
  return { ok: true, data: invite };
}

export const communityInviteService = {
  getInviteLink(code: string): string {
    return `picom://invite/${code}`;
  },

  async createInvite(input: { communityId: string; createdBy: string; canCreate: boolean; maxUses?: number | null; expiresInDays?: number | null }): Promise<InviteResult<CommunityInvite>> {
    if (!input.canCreate) return { ok: false, error: { code: "PERMISSION_DENIED", message: "You do not have permission to create invites." } };
    const code = generateCode();
    const expiresAt = input.expiresInDays ? new Date(Date.now() + input.expiresInDays * 86_400_000).toISOString() : null;

    if (dataSourceService.getStatus().isMock) {
      const store = readMockStore();
      const invite: CommunityInvite = { id: `invite-${crypto.randomUUID()}`, communityId: input.communityId, code, createdBy: input.createdBy, maxUses: input.maxUses ?? null, uses: 0, expiresAt, revokedAt: null, createdAt: new Date().toISOString() };
      writeMockStore({ records: [...store.records, invite] });
      return { ok: true, data: invite };
    }

    const status = getSupabaseClientStatus();
    const client = getSupabaseClient();
    if (!status.configured || !client) return { ok: false, error: { code: "DATA_SOURCE_NOT_CONFIGURED", message: status.reason ?? "Supabase is not configured." } };
    const { data, error } = await client.from("community_invites").insert({ community_id: input.communityId, code, created_by: input.createdBy, max_uses: input.maxUses ?? null, expires_at: expiresAt }).select("id,community_id,code,created_by,max_uses,uses,expires_at,revoked_at,created_at").single();
    return error || !data ? { ok: false, error: { code: "INVITE_CREATE_FAILED", message: "Picom could not create this invite." } } : { ok: true, data: mapInvite(data) };
  },

  async getInviteByCode(rawCode: string): Promise<InviteResult<CommunityInvite>> {
    const code = normalizeCode(rawCode);
    if (!/^[a-zA-Z0-9_-]{8,64}$/.test(code)) return { ok: false, error: { code: "INVITE_INVALID", message: "That invite code is invalid." } };

    if (dataSourceService.getStatus().isMock) {
      const invite = readMockStore().records.find((record) => record.code === code);
      return invite ? validateInvite(invite) : { ok: false, error: { code: "INVITE_INVALID", message: "That invite code is invalid." } };
    }

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: { code: "DATA_SOURCE_NOT_CONFIGURED", message: "Supabase is not configured." } };
    const { data, error } = await client.from("community_invites").select("id,community_id,code,created_by,max_uses,uses,expires_at,revoked_at,created_at").eq("code", code).maybeSingle();
    if (error || !data) return { ok: false, error: { code: "INVITE_INVALID", message: "That invite is unavailable." } };
    return validateInvite(mapInvite(data));
  },

  async revokeInvite(inviteId: string): Promise<InviteResult<CommunityInvite>> {
    if (dataSourceService.getStatus().isMock) {
      const store = readMockStore();
      const invite = store.records.find((record) => record.id === inviteId);
      if (!invite) return { ok: false, error: { code: "INVITE_INVALID", message: "That invite is unavailable." } };
      const revoked = { ...invite, revokedAt: invite.revokedAt ?? new Date().toISOString() };
      writeMockStore({ records: store.records.map((record) => record.id === inviteId ? revoked : record) });
      return { ok: true, data: revoked };
    }

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: { code: "DATA_SOURCE_NOT_CONFIGURED", message: "Supabase is not configured." } };
    const { data, error } = await client.from("community_invites").update({ revoked_at: new Date().toISOString() }).eq("id", inviteId).select("id,community_id,code,created_by,max_uses,uses,expires_at,revoked_at,created_at").single();
    return error || !data ? { ok: false, error: { code: "INVITE_REVOKE_FAILED", message: "Picom could not revoke this invite." } } : { ok: true, data: mapInvite(data) };
  },

  async acceptInvite(input: { code: string; communities: Community[]; currentUser: Member; isAuthenticated: boolean; bannedUserIds?: string[] }): Promise<InviteResult<{ communityId: string; member: Member }>> {
    const code = normalizeCode(input.code);
    if (!input.isAuthenticated) return { ok: false, error: { code: "AUTH_REQUIRED", message: "Sign in before accepting an invite." } };
    if (!/^[a-zA-Z0-9_-]{8,64}$/.test(code)) return { ok: false, error: { code: "INVITE_INVALID", message: "That invite code is invalid." } };

    if (dataSourceService.getStatus().isMock) {
      const store = readMockStore();
      const invite = store.records.find((record) => record.code === code);
      if (!invite) return { ok: false, error: { code: "INVITE_INVALID", message: "That invite code is invalid." } };
      const valid = validateInvite(invite);
      if (!valid.ok) return valid;
      const community = input.communities.find((candidate) => candidate.id === invite.communityId);
      if (!community) return { ok: false, error: { code: "COMMUNITY_NOT_FOUND", message: "The invited community is unavailable." } };
      if (input.bannedUserIds?.includes(input.currentUser.userId)) return { ok: false, error: { code: "INVITE_BANNED", message: "You cannot join this community." } };
      const existingMember = community.members.find((member) => member.userId === input.currentUser.userId);
      if (existingMember) return { ok: true, data: { communityId: community.id, member: existingMember } };
      const joined = await communityMembershipService.joinCommunity({ community, currentUser: input.currentUser, isAuthenticated: true, inviteValidated: true });
      if (!joined.ok) return { ok: false, error: joined.error };
      writeMockStore({ records: store.records.map((record) => record.id === invite.id ? { ...record, uses: record.uses + 1 } : record) });
      return { ok: true, data: { communityId: community.id, member: joined.data } };
    }

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: { code: "DATA_SOURCE_NOT_CONFIGURED", message: "Supabase is not configured." } };
    const { data, error } = await client.rpc("accept_community_invite", { invite_code: code });
    const membership = data?.[0];
    if (error || !membership) return { ok: false, error: { code: "INVITE_ACCEPT_FAILED", message: error?.message.includes("expired") ? "This invite has expired." : "This invite is invalid, expired, revoked, or exhausted." } };
    return { ok: true, data: { communityId: membership.community_id, member: { id: membership.id, userId: membership.user_id, displayName: input.currentUser.displayName, username: input.currentUser.username, avatarSeed: input.currentUser.avatarSeed, avatarUrl: input.currentUser.avatarUrl, status: input.currentUser.status, statusText: "Joined with an invite", roleId: membership.role_id ?? "member", bio: input.currentUser.bio } } };
  },
};
