import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const migration = await readFile(resolve(root, "supabase/migrations/20260803230000_business_catalog_brand_content_and_promotion_bridge.sql"), "utf8");
const service = await readFile(resolve(root, "src/services/verificationBusiness/businessCatalogService.ts"), "utf8");

for (const name of [
  "publish_business_product",
  "submit_business_product_for_review",
  "tag_business_post_product",
  "create_business_post_promotion_request",
  "create_business_promotion_creative_snapshot",
  "create_business_campaign_draft_from_promotion",
  "get_public_business_product",
  "resolve_sponsored_delivery_eligibility",
  "LEGAL_COPY_REQUIRED",
  "BUSINESS_PRODUCT_MALWARE_REVIEW_REQUIRED",
  "AD_CREATIVE_SNAPSHOT_APPEND_ONLY",
]) {
  if (!migration.includes(name)) throw new Error(`Missing catalog contract marker: ${name}`);
}
if (/(^|[^A-Z_])DROP TABLE\b/i.test(migration.replace(/--.*$/gm, ""))) throw new Error("Additive migration must not DROP TABLE.");
if (!service.includes("createCampaignDraft") || !service.includes("createCreativeSnapshot")) {
  throw new Error("Catalog service must expose promotion bridge RPCs.");
}
if (service.includes("status: \"active\"")) throw new Error("Client must not assert campaign active status.");
console.log("Business catalog contract regression passed.");
