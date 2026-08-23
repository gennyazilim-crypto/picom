import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const migration = await readFile(resolve(root, "supabase/migrations/20260803230000_business_catalog_brand_content_and_promotion_bridge.sql"), "utf8");
const edge = await readFile(resolve(root, "supabase/functions/business-product-media-upload-session/index.ts"), "utf8");

for (const marker of [
  "BUSINESS_URL_HTTPS_REQUIRED",
  "BUSINESS_URL_SCHEME_FORBIDDEN",
  "BUSINESS_URL_PRIVATE_FORBIDDEN",
  "BUSINESS_PRODUCT_TAG_CROSS_ORG",
  "BUSINESS_PRODUCT_TAG_LIMIT",
  "business-product-media",
  "malware_scan_status",
]) {
  if (!migration.includes(marker) && !edge.includes(marker)) throw new Error(`Missing security marker: ${marker}`);
}
if (!/svg\|exe/i.test(edge)) throw new Error("Product media upload must reject SVG/EXE.");
if (!migration.includes("BUSINESS_PRODUCT_MALWARE_REVIEW_REQUIRED")) {
  throw new Error("Pending malware must block product publish/submit.");
}
if (!migration.includes("get_public_business_product") || migration.includes("internal_notes") && migration.match(/get_public_business_product[\s\S]{0,800}internal_notes/)) {
  // ensure public DTO builder does not embed internal_notes nearby
}
const publicFn = migration.slice(migration.indexOf("get_public_business_product"));
if (publicFn.slice(0, 2500).includes("internal_notes") || publicFn.slice(0, 2500).includes("storage_path")) {
  throw new Error("Public product DTO must not expose internal notes or storage paths.");
}
console.log("Business product security regression passed.");
