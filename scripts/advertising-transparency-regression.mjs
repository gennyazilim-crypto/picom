import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const migration = await readFile(resolve(root, "supabase/migrations/20260803240000_advertiser_campaign_delivery_and_revenue_attribution.sql"), "utf8");
const pages = await readFile(resolve(root, "src/account/pages/AdvertiserPages.tsx"), "utf8");
const domain = await import(pathToFileURL(resolve(root, "src/services/advertising/adDomain.ts")).href);

for (const name of [
  "get_ad_decision_explanation",
  "hide_ad_decision",
  "report_ad_decision",
  "Sponsored",
  "does not use sensitive attributes",
]) {
  if (!migration.includes(name)) throw new Error(`Missing transparency marker: ${name}`);
}
if (!pages.includes("does not auto-approve creatives")) {
  throw new Error("UI must state Business badge != creative approval");
}

const reasons = domain.publicExplanationReasons(["country", "language"]);
if (!reasons.some((r) => r.includes("sponsored"))) throw new Error("sponsored disclosure missing");
domain.assertNoSensitiveExplanationLeak({
  advertiser_name: "Acme",
  reasons,
  placement: "feed_inline",
});
let leaked = false;
try {
  domain.assertNoSensitiveExplanationLeak({ bid: 12, fraud: 0.9 });
} catch {
  leaked = true;
}
if (!leaked) throw new Error("sensitive explanation leak detector failed");

console.log("Advertising transparency regression passed.");
