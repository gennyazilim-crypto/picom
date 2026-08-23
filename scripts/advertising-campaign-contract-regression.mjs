import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const migration = await readFile(resolve(root, "supabase/migrations/20260803240000_advertiser_campaign_delivery_and_revenue_attribution.sql"), "utf8");
const service = await readFile(resolve(root, "src/services/advertising/advertisingService.ts"), "utf8");
const domain = await import(pathToFileURL(resolve(root, "src/services/advertising/adDomain.ts")).href);

for (const name of [
  "create_advertiser_account_v2",
  "create_ad_campaign",
  "create_ad_set",
  "create_ad_creative",
  "create_ad_creative_snapshot",
  "submit_ad_campaign",
  "CLIENT_CANNOT_ACTIVATE_CAMPAIGN",
  "CLIENT_CANNOT_APPROVE_CREATIVE",
  "POLITICAL_ADVERTISING_DISABLED",
  "LEGAL_COPY_REQUIRED",
  "AD_TARGETING_SENSITIVE_REJECTED",
  "LAST_ADVERTISER_OWNER",
]) {
  if (!migration.includes(name)) throw new Error(`Missing campaign contract marker: ${name}`);
}
if (/(^|[^A-Z_])DROP TABLE\b/i.test(migration.replace(/--.*$/gm, ""))) throw new Error("Additive migration must not DROP TABLE.");
if (!service.includes("createCampaign") || service.includes("status: \"active\"")) {
  throw new Error("Advertising service must expose campaign RPCs without client active assertion.");
}

const targeting = domain.validateTargetingSpec({ country: ["DE"], race: "x" });
if (targeting.ok) throw new Error("Sensitive targeting must be rejected");
const okTargeting = domain.validateTargetingSpec({ country: ["DE"], language: ["de"] });
if (!okTargeting.ok) throw new Error("Allowed targeting should pass");
if (!domain.canTransitionCampaign("draft", "submitted")) throw new Error("draft->submitted required");
if (domain.canTransitionCampaign("draft", "active")) throw new Error("draft->active must be blocked");
if (domain.DISABLED_OBJECTIVES.includes("sales") === false) throw new Error("sales objective must stay disabled");

console.log("Advertising campaign contract regression passed.");
