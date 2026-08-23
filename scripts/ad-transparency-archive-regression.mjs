import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const migration = await readFile(resolve(root, "supabase/migrations/20260803250000_partner_payout_tax_reconciliation_and_ad_transparency.sql"), "utf8");
const domain = await import(pathToFileURL(resolve(root, "src/services/monetization/payoutDomain.ts")).href);

for (const marker of [
  "ad_transparency_archive",
  "ad_transparency_retention",
  "materialize_ad_transparency_archive",
  "get_public_ad_transparency_archive",
  "creative_snapshot_public",
  "legal_hold",
  "DECISION_NOT_ARCHIVABLE",
]) {
  if (!migration.includes(marker)) throw new Error(`Missing transparency marker: ${marker}`);
}

if (!domain.isOrganicBusinessExcludedFromArchive("organic_business_post", false)) {
  throw new Error("organic business posts must be excluded");
}
if (domain.isOrganicBusinessExcludedFromArchive("sponsored_delivery", true)) {
  throw new Error("sponsored delivery should not be excluded");
}

domain.assertPublicTransparencySafe({
  advertiser_display_name: "Acme",
  sponsor_label: "Sponsored",
  destination_domain: "example.com",
  broad_countries: ["DE"],
});

let leak = false;
try {
  domain.assertPublicTransparencySafe({ bid: 12, targeting_spec: { country: "DE" } });
} catch (error) {
  leak = error instanceof Error && error.message.startsWith("TRANSPARENCY_LEAK:");
}
if (!leak) throw new Error("exact targeting/bid must leak-detect");

console.log("Ad transparency archive regression passed.");
