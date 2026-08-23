import { getSupabaseClient } from "../supabase/supabaseClient";

type Failure = Readonly<{ code?: string; message?: string }>;
type Response = Readonly<{ data: unknown; error: Failure | null }>;
interface PlatformClient {
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<Response>;
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        order(column: string, options: { ascending: boolean }): {
          limit(count: number): PromiseLike<Response>;
        };
        maybeSingle(): PromiseLike<Response>;
      };
    };
  };
}

const client = (): PlatformClient | null => getSupabaseClient() as unknown as PlatformClient | null;
const unavailable = () => ({ ok: false as const, error: { code: "NOT_CONFIGURED", message: "Business catalog services are unavailable." } });
const failed = (error: Failure) => ({ ok: false as const, error: { code: error.code ?? "UNAVAILABLE", message: error.message ?? "Business catalog request failed." } });

export const businessCatalogService = {
  async createProductDraft(input: Record<string, unknown>) {
    const db = client(); if (!db) return unavailable();
    const result = await db.rpc("create_business_product", {
      target_organization_id: input.organizationId,
      target_name: input.name,
      target_slug: input.slug,
      target_product_type: input.productType,
      target_short_description: input.shortDescription ?? "",
      target_description: input.description ?? "",
      target_price_amount_minor: input.priceAmountMinor ?? null,
      target_compare_at_price_amount_minor: input.compareAtPriceAmountMinor ?? null,
      target_currency: input.currency ?? "USD",
      target_availability: input.availability ?? "available",
      target_purchase_url: input.purchaseUrl ?? null,
      target_product_url: input.productUrl ?? null,
      target_support_url: input.supportUrl ?? null,
    });
    return result.error ? failed(result.error) : { ok: true as const, data: String(result.data) };
  },

  async submitForReview(productId: string) {
    const db = client(); if (!db) return unavailable();
    const result = await db.rpc("submit_business_product_for_review", { target_product_id: productId });
    return result.error ? failed(result.error) : { ok: true as const, data: undefined };
  },

  async publish(productId: string) {
    const db = client(); if (!db) return unavailable();
    const result = await db.rpc("publish_business_product", { target_product_id: productId });
    return result.error ? failed(result.error) : { ok: true as const, data: undefined };
  },

  async unpublish(productId: string) {
    const db = client(); if (!db) return unavailable();
    const result = await db.rpc("unpublish_business_product", { target_product_id: productId });
    return result.error ? failed(result.error) : { ok: true as const, data: undefined };
  },

  async archive(productId: string) {
    const db = client(); if (!db) return unavailable();
    const result = await db.rpc("archive_business_product", { target_product_id: productId });
    return result.error ? failed(result.error) : { ok: true as const, data: undefined };
  },

  async getPublicProduct(businessSlug: string, productSlug: string) {
    const db = client(); if (!db) return unavailable();
    const result = await db.rpc("get_public_business_product", {
      target_business_slug: businessSlug.replace(/^@/, ""),
      target_product_slug: productSlug,
    });
    return result.error ? failed(result.error) : { ok: true as const, data: result.data as Record<string, unknown> | null };
  },

  async createPost(organizationId: string, postType: string, body: string) {
    const db = client(); if (!db) return unavailable();
    const result = await db.rpc("create_business_post", {
      target_organization_id: organizationId,
      target_post_type: postType,
      target_body: body,
    });
    return result.error ? failed(result.error) : { ok: true as const, data: String(result.data) };
  },

  async publishPost(postId: string) {
    const db = client(); if (!db) return unavailable();
    const result = await db.rpc("publish_business_post", { target_post_id: postId });
    return result.error ? failed(result.error) : { ok: true as const, data: undefined };
  },

  async tagProduct(postId: string, productId: string, position: number) {
    const db = client(); if (!db) return unavailable();
    const result = await db.rpc("tag_business_post_product", {
      target_post_id: postId,
      target_product_id: productId,
      target_position: position,
    });
    return result.error ? failed(result.error) : { ok: true as const, data: undefined };
  },

  async createPromotionRequest(postId: string) {
    const db = client(); if (!db) return unavailable();
    const result = await db.rpc("create_business_post_promotion_request", { target_post_id: postId });
    return result.error ? failed(result.error) : { ok: true as const, data: String(result.data) };
  },

  async createCreativeSnapshot(promotionRequestId: string) {
    const db = client(); if (!db) return unavailable();
    const result = await db.rpc("create_business_promotion_creative_snapshot", { target_promotion_request_id: promotionRequestId });
    return result.error ? failed(result.error) : { ok: true as const, data: String(result.data) };
  },

  async createCampaignDraft(promotionRequestId: string, campaignName: string) {
    const db = client(); if (!db) return unavailable();
    const result = await db.rpc("create_business_campaign_draft_from_promotion", {
      target_promotion_request_id: promotionRequestId,
      target_campaign_name: campaignName,
    });
    return result.error ? failed(result.error) : { ok: true as const, data: String(result.data) };
  },

  async ingestEvent(input: Readonly<{
    eventType: string; organizationId: string; idempotencyKey: string;
    productId?: string; postId?: string; placement?: string;
  }>) {
    const db = client(); if (!db) return unavailable();
    const result = await db.rpc("ingest_business_content_event", {
      target_event_type: input.eventType,
      target_organization_id: input.organizationId,
      target_idempotency_key: input.idempotencyKey,
      target_product_id: input.productId ?? null,
      target_post_id: input.postId ?? null,
      target_placement: input.placement ?? null,
    });
    return result.error ? failed(result.error) : { ok: true as const, data: String(result.data) };
  },

  async report(input: Readonly<{ subjectType: "business_profile" | "product" | "post"; subjectId: string; reasonCode: string; details?: string; organizationId?: string }>) {
    const db = client(); if (!db) return unavailable();
    const result = await db.rpc("report_business_content", {
      target_subject_type: input.subjectType,
      target_subject_id: input.subjectId,
      target_reason_code: input.reasonCode,
      target_details: input.details ?? null,
      target_organization_id: input.organizationId ?? null,
    });
    return result.error ? failed(result.error) : { ok: true as const, data: String(result.data) };
  },

  async analyticsOverview(organizationId: string) {
    const db = client(); if (!db) return unavailable();
    const result = await db.rpc("get_business_analytics_overview", { target_organization_id: organizationId });
    return result.error ? failed(result.error) : { ok: true as const, data: result.data };
  },

  async sponsoredDeliveryEligibility(userId: string, campaignId: string) {
    const db = client(); if (!db) return unavailable();
    const result = await db.rpc("resolve_sponsored_delivery_eligibility", {
      target_user_id: userId,
      target_campaign_id: campaignId,
    });
    return result.error ? failed(result.error) : { ok: true as const, data: result.data as Record<string, unknown> };
  },
};
