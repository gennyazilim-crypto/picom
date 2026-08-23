import { getSupabaseClient } from "../supabase/supabaseClient";
import type { PublicBusinessProfileBundle } from "../../types/verificationBusiness/businessApplication";

type Response = Readonly<{ data: unknown; error: { code?: string; message?: string } | null }>;
interface PlatformClient { rpc(name: string, args?: Record<string, unknown>): PromiseLike<Response>; }
const client = (): PlatformClient | null => getSupabaseClient() as unknown as PlatformClient | null;
const unavailable = () => ({ ok: false as const, error: "Business profiles are unavailable." });
const rpc = async (name: string, args: Record<string, unknown>) => {
  const db = client(); if (!db) return unavailable();
  const response = await db.rpc(name, args);
  return response.error ? { ok: false as const, error: response.error.message ?? "Business profile request failed." } : { ok: true as const, data: response.data };
};

export const businessProfilePublicService = {
  async getPublicBundle(slug: string) {
    const response = await rpc("get_public_business_profile_bundle", { target_slug: slug });
    return response.ok ? { ok: true as const, data: response.data as PublicBusinessProfileBundle | null } : response;
  },
  async follow(organizationId: string) { return rpc("follow_business_profile", { target_organization_id: organizationId }); },
  async unfollow(organizationId: string) { return rpc("unfollow_business_profile", { target_organization_id: organizationId }); },
};
