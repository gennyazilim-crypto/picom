import { getSupabaseClient } from "../supabase/supabaseClient";

export type PublisherStudioContext = Readonly<{
  ok: boolean;
  has_studio_access?: boolean;
  publisher_user_id?: string;
  actor_user_id?: string;
  is_owner?: boolean;
  role_key?: string;
  membership_status?: string;
  permissions?: ReadonlyArray<string>;
  finance_isolated?: boolean;
  reason?: string;
  error?: string;
  note?: string;
}>;

type RpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

function client(): RpcClient | null {
  return getSupabaseClient() as unknown as RpcClient | null;
}

async function sha256Hex(raw: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const publisherStudioService = {
  async bootstrap(): Promise<{ ok: true; data: PublisherStudioContext } | { ok: false; error: string }> {
    const supabase = client();
    if (!supabase) return { ok: false, error: "SUPABASE_UNAVAILABLE" };
    const { data, error } = await supabase.rpc("bootstrap_my_publisher_studio");
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? {}) as PublisherStudioContext };
  },

  async getContext(): Promise<{ ok: true; data: PublisherStudioContext } | { ok: false; error: string }> {
    const supabase = client();
    if (!supabase) return { ok: false, error: "SUPABASE_UNAVAILABLE" };
    const { data, error } = await supabase.rpc("get_my_publisher_studio_context");
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? {}) as PublisherStudioContext };
  },

  async getReadiness(): Promise<{ ok: true; items: ReadonlyArray<Record<string, unknown>> } | { ok: false; error: string }> {
    const supabase = client();
    if (!supabase) return { ok: false, error: "SUPABASE_UNAVAILABLE" };
    const { data, error } = await supabase.rpc("get_my_publisher_studio_readiness");
    if (error) return { ok: false, error: error.message };
    const row = (data ?? {}) as { ok?: boolean; items?: unknown; error?: string };
    if (!row.ok) return { ok: false, error: row.error ?? "READINESS_DENIED" };
    return { ok: true, items: Array.isArray(row.items) ? (row.items as Record<string, unknown>[]) : [] };
  },

  async listTeamMembers(): Promise<{ ok: true; items: ReadonlyArray<Record<string, unknown>> } | { ok: false; error: string }> {
    const supabase = client();
    if (!supabase) return { ok: false, error: "SUPABASE_UNAVAILABLE" };
    const { data, error } = await supabase.rpc("list_my_publisher_team_members", { p_limit: 50 });
    if (error) return { ok: false, error: error.message };
    const row = (data ?? {}) as { ok?: boolean; items?: unknown; error?: string };
    if (!row.ok) return { ok: false, error: row.error ?? "TEAM_DENIED" };
    return { ok: true, items: Array.isArray(row.items) ? (row.items as Record<string, unknown>[]) : [] };
  },

  async listAudit(domain?: string): Promise<{ ok: true; items: ReadonlyArray<Record<string, unknown>> } | { ok: false; error: string }> {
    const supabase = client();
    if (!supabase) return { ok: false, error: "SUPABASE_UNAVAILABLE" };
    const { data, error } = await supabase.rpc("list_my_publisher_studio_audit", {
      p_limit: 40,
      p_domain: domain ?? null,
    });
    if (error) return { ok: false, error: error.message };
    const row = (data ?? {}) as { ok?: boolean; items?: unknown; error?: string };
    if (!row.ok) return { ok: false, error: row.error ?? "AUDIT_DENIED" };
    return { ok: true, items: Array.isArray(row.items) ? (row.items as Record<string, unknown>[]) : [] };
  },

  async createInvitation(input: {
    roleKey: string;
    inviteeUserId?: string;
    inviteeEmail?: string;
  }): Promise<{ ok: true; data: Record<string, unknown>; plaintextTokenOnce: string } | { ok: false; error: string }> {
    const supabase = client();
    if (!supabase) return { ok: false, error: "SUPABASE_UNAVAILABLE" };
    const plaintext = randomToken();
    const tokenHash = await sha256Hex(plaintext);
    const tokenHint = tokenHash.slice(0, 8);
    const { data, error } = await supabase.rpc("create_publisher_team_invitation", {
      p_role_key: input.roleKey,
      p_invitee_user_id: input.inviteeUserId ?? null,
      p_invitee_email: input.inviteeEmail ?? null,
      p_expires_hours: 72,
      p_token_hash: tokenHash,
      p_token_hint: tokenHint,
    });
    if (error) return { ok: false, error: error.message };
    const row = (data ?? {}) as Record<string, unknown>;
    if (!row.ok) return { ok: false, error: String(row.error ?? "INVITE_FAILED") };
    // Plaintext returned once to inviter UI for in-app copy; never logged by service.
    return { ok: true, data: row, plaintextTokenOnce: plaintext };
  },

  async acceptInvitation(plaintextToken: string): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
    const supabase = client();
    if (!supabase) return { ok: false, error: "SUPABASE_UNAVAILABLE" };
    const tokenHash = await sha256Hex(plaintextToken.trim().toLowerCase());
    const { data, error } = await supabase.rpc("accept_publisher_team_invitation", {
      p_token_hash: tokenHash,
    });
    if (error) return { ok: false, error: error.message };
    const row = (data ?? {}) as Record<string, unknown>;
    if (!row.ok) return { ok: false, error: String(row.error ?? "ACCEPT_FAILED") };
    return { ok: true, data: row };
  },

  async removeMember(memberUserId: string): Promise<{ ok: true } | { ok: false; error: string }> {
    const supabase = client();
    if (!supabase) return { ok: false, error: "SUPABASE_UNAVAILABLE" };
    const { data, error } = await supabase.rpc("remove_publisher_team_member", {
      p_member_user_id: memberUserId,
    });
    if (error) return { ok: false, error: error.message };
    const row = (data ?? {}) as Record<string, unknown>;
    if (!row.ok) return { ok: false, error: String(row.error ?? "REMOVE_FAILED") };
    return { ok: true };
  },

  async changeMemberRole(memberUserId: string, roleKey: string): Promise<{ ok: true } | { ok: false; error: string }> {
    const supabase = client();
    if (!supabase) return { ok: false, error: "SUPABASE_UNAVAILABLE" };
    const { data, error } = await supabase.rpc("change_publisher_team_member_role", {
      p_member_user_id: memberUserId,
      p_role_key: roleKey,
    });
    if (error) return { ok: false, error: error.message };
    const row = (data ?? {}) as Record<string, unknown>;
    if (!row.ok) return { ok: false, error: String(row.error ?? "ROLE_CHANGE_FAILED") };
    return { ok: true };
  },

  hasPermission(ctx: PublisherStudioContext | null, permission: string): boolean {
    if (!ctx?.has_studio_access) return false;
    if (ctx.is_owner) return true;
    return Array.isArray(ctx.permissions) && ctx.permissions.includes(permission);
  },
};
