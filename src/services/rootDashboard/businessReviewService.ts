import { getSupabaseClient } from "../supabase/supabaseClient";
import type { BusinessApplicationAdminDto } from "../../types/verificationBusiness/businessApplication";

type Response = Readonly<{ data: unknown; error: { code?: string; message?: string } | null }>;
interface PlatformClient { rpc(name: string, args?: Record<string, unknown>): PromiseLike<Response>; }
const client = (): PlatformClient | null => getSupabaseClient() as unknown as PlatformClient | null;
const unavailable = () => ({ ok: false as const, error: "Business review service is unavailable." });
const call = async (name: string, args?: Record<string, unknown>) => {
  const db = client(); if (!db) return unavailable();
  const response = await db.rpc(name, args);
  return response.error ? { ok: false as const, error: response.error.message ?? "Review request failed." } : { ok: true as const, data: response.data };
};

/** UI access is checked by the root dashboard; the database repeats that authorization. */
export const businessReviewService = {
  async listApplications() {
    const response = await call("list_admin_business_applications");
    return response.ok ? { ok: true as const, data: Array.isArray(response.data) ? response.data as BusinessApplicationAdminDto[] : [] } : response;
  },
  async getAdminDto(applicationId: string) {
    const response = await call("get_business_application_admin_dto", { target_application_id: applicationId });
    return response.ok ? { ok: true as const, data: response.data as BusinessApplicationAdminDto } : response;
  },
  async transition(input: Readonly<{
    applicationId: string;
    status: "approved" | "rejected" | "suspended" | "revoked" | "requires_information" | "under_review" | "identity_verification_required";
    publicReason?: string;
    internalNotes?: string;
    idempotencyKey?: string;
  }>) {
    if (input.status === "approved") {
      return call("approve_business_application", {
        target_application_id: input.applicationId,
        target_public_reason: input.publicReason ?? null,
        target_internal_notes: input.internalNotes ?? null,
        target_idempotency_key: input.idempotencyKey ?? null,
      });
    }
    return call("transition_business_application", {
      target_application_id: input.applicationId,
      target_status: input.status,
      target_public_reason: input.publicReason ?? null,
      target_internal_notes: input.internalNotes ?? null,
    });
  },
};
