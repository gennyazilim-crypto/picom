import type { Community, Member } from "../../types/community";
import { dataSourceService } from "../dataSourceService";
import { getSupabaseClient, getSupabaseClientStatus } from "../supabase/supabaseClient";
import { communityMembershipService } from "./communityMembershipService";
import { auditLogService } from "../auditLogService";
import { isCommunityKind, type CommunityKind } from "../../types/community";
import { userBlockingService } from "../userBlockingService";

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
  campaignLabel: string | null;
  lastUsedAt: string | null;
}>;
export type InviteCampaignSummary = Omit<CommunityInvite, "code"> & Readonly<{ creatorName: string }>;
export type InviteAcceptanceStatus = "joined" | "already_member";
export type CommunityInvitePreview = Readonly<{
  communityId: string;
  communityName: string;
  communityKind: CommunityKind;
  description: string | null;
  visibility: "public" | "private";
  memberCount: number;
  expiresAt: string | null;
}>;

type InvitePreviewRow = {
  community_id: string;
  community_name: string;
  community_kind: string;
  description: string | null;
  visibility: string;
  member_count: number;
  expires_at: string | null;
};

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
  return (deepLinkMatch?.[1] ?? trimmed).toLowerCase();
}

function mapInviteAcceptanceError(message?: string): InviteResult<never> {
  const mappings = [
    ["AUTH_REQUIRED", "AUTH_REQUIRED", "Sign in before accepting an invite."],
    ["INVITE_BANNED", "INVITE_BANNED", "You cannot join this community."],
    ["JOIN_BANNED", "INVITE_BANNED", "You cannot join this community."],
    ["INVITE_BLOCKED", "INVITE_BLOCKED", "This community cannot be joined while a blocking relationship is active."],
    ["JOIN_BLOCKED", "INVITE_BLOCKED", "This community cannot be joined while a blocking relationship is active."],
    ["INVITE_EXPIRED", "INVITE_EXPIRED", "This invite has expired."],
    ["INVITE_REVOKED", "INVITE_REVOKED", "This invite has been revoked."],
    ["INVITE_EXHAUSTED", "INVITE_EXHAUSTED", "This invite has reached its use limit."],
    ["DEFAULT_ROLE_MISSING", "INVITE_UNAVAILABLE", "This community is not ready to accept members."],
    ["INVITE_INVALID", "INVITE_INVALID", "That invite code is invalid."],
  ] as const;
  const match = mappings.find(([marker]) => message?.includes(marker));
  return { ok: false, error: { code: match?.[1] ?? "INVITE_ACCEPT_FAILED", message: match?.[2] ?? "This invite is invalid, expired, revoked, or exhausted." } };
}

function mapInvite(row: {
  id: string; community_id: string; code: string; created_by: string; max_uses: number | null; uses: number; expires_at: string | null; revoked_at: string | null; created_at: string; campaign_label?: string | null; last_used_at?: string | null;
}): CommunityInvite {
  return { id: row.id, communityId: row.community_id, code: row.code, createdBy: row.created_by, maxUses: row.max_uses, uses: row.uses, expiresAt: row.expires_at, revokedAt: row.revoked_at, createdAt: row.created_at, campaignLabel: row.campaign_label ?? null, lastUsedAt: row.last_used_at ?? null };
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

  async createInvite(input: { communityId: string; createdBy: string; canCreate: boolean; maxUses?: number | null; expiresInDays?: number | null; campaignLabel?: string | null }): Promise<InviteResult<CommunityInvite>> {
    if (!input.canCreate) return { ok: false, error: { code: "PERMISSION_DENIED", message: "You do not have permission to create invites." } };
    const code = generateCode();
    const expiresAt = input.expiresInDays ? new Date(Date.now() + input.expiresInDays * 86_400_000).toISOString() : null;

    if (dataSourceService.getStatus().isMock) {
      const store = readMockStore();
      const invite: CommunityInvite = { id: `invite-${crypto.randomUUID()}`, communityId: input.communityId, code, createdBy: input.createdBy, maxUses: input.maxUses ?? null, uses: 0, expiresAt, revokedAt: null, createdAt: new Date().toISOString(), campaignLabel: input.campaignLabel?.trim().slice(0, 80) || null, lastUsedAt: null };
      writeMockStore({ records: [...store.records, invite] });
      await auditLogService.append({ communityId: input.communityId, actorId: input.createdBy, actionType: "invite_create", targetType: "invite", targetId: invite.id, reason: "Invite created" });
      return { ok: true, data: invite };
    }

    const status = getSupabaseClientStatus();
    const client = getSupabaseClient();
    if (!status.configured || !client) return { ok: false, error: { code: "DATA_SOURCE_NOT_CONFIGURED", message: status.reason ?? "Supabase is not configured." } };
    const { data, error } = await client.rpc("create_community_invite", { target_community_id: input.communityId, target_max_uses: input.maxUses ?? null, target_expires_at: expiresAt, target_campaign_label: input.campaignLabel?.trim().slice(0, 80) || null });
    const row=data?.[0]; if (error || !row) return { ok: false, error: { code: "INVITE_CREATE_FAILED", message: "Picom could not create this invite." } };
    return { ok: true, data: mapInvite(row) };
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
    const { data, error } = await client.from("community_invites").select("id,community_id,code,created_by,max_uses,uses,expires_at,revoked_at,created_at,campaign_label,last_used_at").eq("code", code).maybeSingle();
    if (error || !data) return { ok: false, error: { code: "INVITE_INVALID", message: "That invite is unavailable." } };
    return validateInvite(mapInvite(data));
  },

  async getInvitePreview(rawCode: string, communities: Community[]): Promise<InviteResult<CommunityInvitePreview>> {
    const code = normalizeCode(rawCode);
    if (!/^[a-zA-Z0-9_-]{8,64}$/.test(code)) return { ok: false, error: { code: "INVITE_INVALID", message: "That invite code is invalid." } };

    if (dataSourceService.getStatus().isMock) {
      const invite = readMockStore().records.find((record) => record.code === code);
      if (!invite) return { ok: false, error: { code: "INVITE_INVALID", message: "That invite code is invalid." } };
      const valid = validateInvite(invite);
      if (!valid.ok) return valid;
      const community = communities.find((candidate) => candidate.id === invite.communityId);
      if (!community) return { ok: false, error: { code: "COMMUNITY_NOT_FOUND", message: "The invited community is unavailable." } };
      if (community.ownerId && userBlockingService.isBlocked(community.ownerId)) return { ok: false, error: { code: "INVITE_BLOCKED", message: "This community cannot be joined while a blocking relationship is active." } };
      return { ok: true, data: { communityId: community.id, communityName: community.name, communityKind: community.kind, description: community.description ?? null, visibility: community.visibility ?? "private", memberCount: community.members.length, expiresAt: invite.expiresAt } };
    }

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: { code: "DATA_SOURCE_NOT_CONFIGURED", message: "Supabase is not configured." } };
    const response = await client.rpc("get_community_invite_preview" as never, { invite_code: code } as never);
    const row = (response.data as unknown as InvitePreviewRow[] | null)?.[0];
    if (response.error || !row) return mapInviteAcceptanceError(response.error?.message);
    if (!isCommunityKind(row.community_kind) || (row.visibility !== "public" && row.visibility !== "private")) return { ok: false, error: { code: "INVITE_INVALID", message: "That invite has invalid community metadata." } };
    return { ok: true, data: { communityId: row.community_id, communityName: row.community_name, communityKind: row.community_kind, description: row.description, visibility: row.visibility, memberCount: row.member_count, expiresAt: row.expires_at } };
  },

  async revokeInvite(inviteId: string): Promise<InviteResult<CommunityInvite>> {
    if (dataSourceService.getStatus().isMock) {
      const store = readMockStore();
      const invite = store.records.find((record) => record.id === inviteId);
      if (!invite) return { ok: false, error: { code: "INVITE_INVALID", message: "That invite is unavailable." } };
      const revoked = { ...invite, revokedAt: invite.revokedAt ?? new Date().toISOString() };
      writeMockStore({ records: store.records.map((record) => record.id === inviteId ? revoked : record) });
      await auditLogService.append({ communityId: invite.communityId, actorId: invite.createdBy, actionType: "invite_revoke", targetType: "invite", targetId: invite.id, reason: "Invite revoked" });
      return { ok: true, data: revoked };
    }

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: { code: "DATA_SOURCE_NOT_CONFIGURED", message: "Supabase is not configured." } };
    const { data, error } = await client.rpc("revoke_community_invite", { target_invite_id: inviteId });
    const row=data?.[0]; if (error || !row) return { ok: false, error: { code: "INVITE_REVOKE_FAILED", message: "Picom could not revoke this invite." } };
    return { ok: true, data: mapInvite(row) };
  },

  async listInviteCampaigns(communityId: string): Promise<InviteResult<InviteCampaignSummary[]>> {
    if (dataSourceService.getStatus().isMock) return { ok: true, data: readMockStore().records.filter((item)=>item.communityId===communityId).map(({code: _code,...item})=>({...item,creatorName:"Mock creator"})) };
    const client=getSupabaseClient(); if(!client)return {ok:false,error:{code:"DATA_SOURCE_NOT_CONFIGURED",message:"Supabase is not configured."}};
    const {data,error}=await client.rpc("list_community_invite_campaigns",{target_community_id:communityId});
    if(error)return {ok:false,error:{code:"INVITE_LIST_FAILED",message:"Picom could not load invite campaigns."}};
    return {ok:true,data:(data??[]).map((row)=>({id:row.id,communityId:row.community_id,createdBy:row.created_by,creatorName:row.creator_name,maxUses:row.max_uses,uses:row.uses,expiresAt:row.expires_at,revokedAt:row.revoked_at,createdAt:row.created_at,campaignLabel:row.campaign_label,lastUsedAt:row.last_used_at}))};
  },

  async acceptInvite(input: { code: string; communities: Community[]; currentUser: Member; isAuthenticated: boolean; bannedUserIds?: string[] }): Promise<InviteResult<{ communityId: string; member: Member; status: InviteAcceptanceStatus }>> {
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
      if (community.ownerId && userBlockingService.isBlocked(community.ownerId)) return { ok: false, error: { code: "INVITE_BLOCKED", message: "This community cannot be joined while a blocking relationship is active." } };
      const existingMember = community.members.find((member) => member.userId === input.currentUser.userId);
      if (existingMember) return { ok: true, data: { communityId: community.id, member: existingMember, status: "already_member" } };
      const joined = await communityMembershipService.joinCommunity({ community, currentUser: input.currentUser, isAuthenticated: true, inviteValidated: true });
      if (!joined.ok) return { ok: false, error: joined.error };
      writeMockStore({ records: store.records.map((record) => record.id === invite.id ? { ...record, uses: record.uses + 1 } : record) });
      await auditLogService.append({ communityId: community.id, actorId: input.currentUser.userId, actionType: "invite_accept", targetType: "invite", targetId: invite.id, reason: "Invite accepted" });
      return { ok: true, data: { communityId: community.id, member: joined.data.member, status: "joined" } };
    }

    const client = getSupabaseClient();
    if (!client) return { ok: false, error: { code: "DATA_SOURCE_NOT_CONFIGURED", message: "Supabase is not configured." } };
    const { data, error } = await client.rpc("accept_community_invite_v2", { invite_code: code });
    const membership = data?.[0];
    if (error || !membership) return mapInviteAcceptanceError(error?.message);
    return { ok: true, data: { communityId: membership.community_id, status: membership.acceptance_status, member: { id: membership.id, userId: membership.user_id, displayName: input.currentUser.displayName, username: input.currentUser.username, avatarSeed: input.currentUser.avatarSeed, avatarUrl: input.currentUser.avatarUrl, status: input.currentUser.status, statusText: membership.acceptance_status === "already_member" ? "Already a community member" : "Joined with an invite", roleId: membership.role_id, bio: input.currentUser.bio } } };
  },
};
