/**
 * Static migration-chain validation for Task 01–06 + publisher compatibility predecessors.
 * Does not claim Docker clean-reset PASS. Emits PASS_STATIC or FAIL.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migDir = path.join(root, "supabase", "migrations");

const CANONICAL_TASK_SHA = Object.freeze({
  "20260803173000_verification_business_platform_foundation.sql":
    "6fc0010d9a82e4b7fe0b0fdec95f686bedd6355b0456574de32cb04474dfd64c",
  "20260803210000_picom_verified_subscription_and_entitlements.sql":
    "a0a4ee0512f9be2fa33a22dd6299b25800f2a42f0cb67e7f5d1899a8a94d921d",
  "20260803220000_business_application_verification_and_team_management.sql":
    "be37310c444737a78f2bfc8950a6eb3c270b5783ebedde19d2f3357e4611b960",
  "20260803221951_live_screen_session_metadata.sql":
    "87d557e440a68257b41d426552dc702b09e958600d49d819fc99c55818ed4919",
  "20260803225000_drop_foundation_public_business_views_for_catalog_rebuild.sql":
    "8c0242941f4cdd9c9ae63e3d876fcdb201b71305add54ce26f7e9ce61cf7d53e",
  "20260803230000_business_catalog_brand_content_and_promotion_bridge.sql":
    "43908b6fca260fdb8fa3748d140873ac2e23661a9b78c813c12d0624ccc7e4d0",
  "20260803240000_advertiser_campaign_delivery_and_revenue_attribution.sql":
    "ca8f0de91b8ed06021046ce2992eac2e1fffc028f3cc909f7da3c69a79bb461e",
  "20260803250000_partner_payout_tax_reconciliation_and_ad_transparency.sql":
    "832e3c9be1d5963270972a9072e9eba0ea4b22768fed158ed81c326f36d788e3",
  "20260803270000_advertising_acl_role_catalog_rls_and_test_hardening.sql":
    "2468189af3abf322b982c633cf07f21288ac3634c84018004ebb1c292cc680c0",
});

const COMPAT = Object.freeze([
  "20260803135000_platform_account_restrictions_canonical.sql",
  "20260803135100_notification_preferences_canonical.sql",
  "20260803135200_live_broadcaster_notification_prefs_canonical.sql",
  "20260803135300_profiles_deactivated_at_canonical.sql",
]);

function lfSha256(filePath) {
  const n = fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n").replace(/^\uFEFF/, "");
  return crypto.createHash("sha256").update(n, "utf8").digest("hex");
}

function main() {
  const errors = [];
  const files = fs
    .readdirSync(migDir)
    .filter((f) => f.startsWith("20260803") && f.endsWith(".sql"))
    .sort();

  for (const [name, expected] of Object.entries(CANONICAL_TASK_SHA)) {
    const full = path.join(migDir, name);
    if (!fs.existsSync(full)) {
      errors.push(`MISSING_${name}`);
      continue;
    }
    const actual = lfSha256(full);
    if (actual !== expected) errors.push(`SHA_MISMATCH_${name}`);
    else console.log(`SHA_OK ${name} ${actual}`);
  }

  for (const name of COMPAT) {
    const full = path.join(migDir, name);
    if (!fs.existsSync(full)) {
      errors.push(`MISSING_COMPAT_${name}`);
      continue;
    }
    const body = fs.readFileSync(full, "utf8");
    if (name.includes("platform_account_restrictions") && !body.includes("platform_account_restrictions")) {
      errors.push("COMPAT_RESTRICTIONS_MISSING_TABLE_DDL");
    }
    if (name.includes("profiles_deactivated") && !body.includes("deactivated_at")) {
      errors.push("COMPAT_DEACTIVATED_AT_MISSING_COLUMN_DDL");
    }
    console.log(`COMPAT_OK ${name} ${lfSha256(full)}`);
  }

  const idx140 = files.indexOf("20260803140000_publisher_creator_program_core.sql");
  const idx135 = files.indexOf("20260803135000_platform_account_restrictions_canonical.sql");
  const idx353 = files.indexOf("20260803135300_profiles_deactivated_at_canonical.sql");
  if (!(idx135 >= 0 && idx353 >= 0 && idx140 >= 0 && idx135 < idx140 && idx353 < idx140)) {
    errors.push("COMPAT_ORDER_BEFORE_PUBLISHER_CORE_FAILED");
  } else {
    console.log("ORDER_OK platform_account_restrictions and profiles.deactivated_at precede 140000");
  }

  // Detect invalid single-dollar function bodies that break `supabase db reset`.
  for (const name of files) {
    const body = fs.readFileSync(path.join(migDir, name), "utf8");
    if (/as \$\r?\n/.test(body) || /\n\$;\r?\n/.test(body)) {
      errors.push(`INVALID_SINGLE_DOLLAR_QUOTE_${name}`);
      console.error(`INVALID_SINGLE_DOLLAR_QUOTE ${name}`);
    }
  }

  if (errors.length) {
    console.error("MIGRATION_CHAIN_STATIC=FAIL");
    for (const e of errors) console.error(`CODE=${e}`);
    process.exit(1);
  }

  console.log("MIGRATION_CHAIN_STATIC=PASS_STATIC");
  // Clean-reset PASS/FAIL is recorded in TASK 08B audit docs; this script does not invoke Docker.
  console.log("MIGRATION_CHAIN_CLEAN_RESET=SEE_TASK08B_AUDIT");
  process.exit(0);
}

main();
