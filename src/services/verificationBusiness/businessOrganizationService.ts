import { getSupabaseClient } from "../supabase/supabaseClient";

type Response = Readonly<{ data: unknown; error: { code?: string; message?: string } | null }>;
interface PlatformClient { rpc(name: string, args?: Record<string, unknown>): PromiseLike<Response>; }
const client = (): PlatformClient | null => getSupabaseClient() as unknown as PlatformClient | null;
const noClient = () => ({ ok: false as const, error: "Business services are unavailable." });
const result = (response: Response) => response.error ? { ok: false as const, error: response.error.message ?? "Business request failed." } : { ok: true as const, data: response.data };

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const businessOrganizationService = {
  async createOrganization(input: Record<string, unknown>) {
    const db = client(); if (!db) return noClient();
    return result(await db.rpc("create_organization", input));
  },
  async inviteMember(input: Readonly<{ organizationId: string; email: string; role: string; expiresAt: string }>) {
    const db = client(); if (!db) return noClient();
    const rawToken = randomToken();
    const response = await db.rpc("create_organization_invitation", {
      target_organization_id: input.organizationId, target_email: input.email, target_role: input.role,
      target_token_hash: await sha256(rawToken), target_expires_at: input.expiresAt,
    });
    if (response.error) return { ok: false as const, error: response.error.message ?? "Invitation failed." };
    return { ok: true as const, data: { invitationId: String(response.data), rawToken } };
  },
  async acceptInvitation(rawToken: string) {
    const db = client(); if (!db) return noClient();
    return result(await db.rpc("accept_organization_invitation", { target_token_hash: await sha256(rawToken) }));
  },
  async removeMemberSafe(organizationId: string, userId: string) {
    const db = client(); if (!db) return noClient();
    return result(await db.rpc("remove_organization_member_safe", { target_organization_id: organizationId, target_user_id: userId }));
  },
  async startOwnershipTransfer(organizationId: string, userId: string, expiresAt: string) {
    const db = client(); if (!db) return noClient();
    const rawToken = randomToken();
    const response = await db.rpc("start_organization_ownership_transfer", {
      target_organization_id: organizationId, target_user_id: userId, target_token_hash: await sha256(rawToken), target_expires_at: expiresAt,
    });
    return response.error ? { ok: false as const, error: response.error.message ?? "Ownership transfer failed." } : { ok: true as const, data: { transferId: String(response.data), rawToken } };
  },
  async acceptOwnershipTransfer(rawToken: string) {
    const db = client(); if (!db) return noClient();
    return result(await db.rpc("accept_organization_ownership_transfer", { target_token_hash: await sha256(rawToken) }));
  },
};
