import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const migration = await readFile(resolve(root, "supabase/migrations/20260803230000_business_catalog_brand_content_and_promotion_bridge.sql"), "utf8");
const verified = await readFile(resolve(root, "supabase/migrations/20260803210000_picom_verified_subscription_and_entitlements.sql"), "utf8");

if (!migration.includes("create_business_post_promotion_request")) throw new Error("Missing promotion request RPC.");
if (!migration.includes("create_business_promotion_creative_snapshot")) throw new Error("Missing creative snapshot RPC.");
if (!migration.includes("create_business_campaign_draft_from_promotion")) throw new Error("Missing campaign draft RPC.");
if (!migration.includes("-- Source post remains organic")) throw new Error("Promotion bridge must keep source post organic.");
if (!migration.includes("'traffic', 'draft', 'pending'")) throw new Error("Campaign draft must be created as draft.");
if (!migration.includes("resolve_sponsored_delivery_eligibility")) throw new Error("Sponsored delivery eligibility RPC missing.");
if (!verified.includes("resolve_ad_eligibility")) throw new Error("Verified ad eligibility foundation missing.");
if (!verified.includes("ad_free_entitlement")) throw new Error("ad_free suppression contract missing.");
if (!migration.includes("'business_sponsored'")) throw new Error("Sponsored placement must reuse resolve_ad_eligibility path.");
if (migration.includes("update public.business_posts set sponsorship_state = 'sponsored'")) {
  throw new Error("Promotion must not convert organic source posts into sponsored posts.");
}
console.log("Business organic/sponsored separation regression passed.");
