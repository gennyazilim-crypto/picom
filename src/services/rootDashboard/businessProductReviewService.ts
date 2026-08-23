import { getSupabaseClient } from "../supabase/supabaseClient";

type Response = Readonly<{ data: unknown; error: { code?: string; message?: string } | null }>;
interface PlatformClient { rpc(name: string, args?: Record<string, unknown>): PromiseLike<Response>; }
const client = (): PlatformClient | null => getSupabaseClient() as unknown as PlatformClient | null;
const unavailable = () => ({ ok: false as const, error: "Business product review is unavailable." });

export const businessProductReviewService = {
  async review(input: Readonly<{
    productId: string;
    status: "approved" | "requires_changes" | "rejected" | "suspended";
    reasonCode: string;
    publicReason?: string;
    internalNotes?: string;
  }>) {
    const db = client(); if (!db) return unavailable();
    const response = await db.rpc("root_review_business_product", {
      target_product_id: input.productId,
      target_status: input.status,
      target_reason_code: input.reasonCode,
      target_public_reason: input.publicReason ?? null,
      target_internal_notes: input.internalNotes ?? null,
    });
    return response.error
      ? { ok: false as const, error: response.error.message ?? "Review failed." }
      : { ok: true as const, data: undefined };
  },
};
