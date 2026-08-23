/**
 * Generates production release + migration manifests (value-free hashes only).
 * Usage: node scripts/generate-production-release-manifests.mjs [--release-commit=<sha>]
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function lfSha256(content) {
  const n = String(content).replace(/\r\n/g, "\n").replace(/^\uFEFF/, "");
  return crypto.createHash("sha256").update(n, "utf8").digest("hex");
}

function fileLfSha256(rel) {
  return lfSha256(fs.readFileSync(path.join(root, rel)));
}

function parseArgs(argv) {
  let releaseCommit = null;
  for (const arg of argv) {
    if (arg.startsWith("--release-commit=")) releaseCommit = arg.slice("--release-commit=".length);
  }
  return { releaseCommit };
}

function listEdgeFunctions() {
  const dir = path.join(root, "supabase", "functions");
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== "_shared")
    .map((d) => d.name)
    .sort()
    .map((name) => {
      const indexRel = path.join("supabase", "functions", name, "index.ts");
      const full = path.join(root, indexRel);
      return {
        name,
        sourcePath: indexRel.replace(/\\/g, "/"),
        sourceSha256: fs.existsSync(full) ? fileLfSha256(indexRel) : null,
        deployVersion: "NOT_DEPLOYED_THIS_TASK",
        jwtRequired: "UNKNOWN_UNTIL_HOSTED_CANARY",
        rollbackVersion: null,
      };
    });
}

function migrationMeta(filename) {
  const rel = path.join("supabase", "migrations", filename);
  const body = fs.readFileSync(path.join(root, rel), "utf8");
  const timestamp = filename.slice(0, 14);
  const destructive =
    /\bdrop\s+table\b/i.test(body) || /\btruncate\b/i.test(body) || /\bdrop\s+column\b/i.test(body);
  return {
    filename,
    timestamp,
    lfNormalizedSha256: fileLfSha256(rel),
    dependencies: inferDeps(filename),
    tablesFunctionsChanged: summarizeChanged(body),
    estimatedLockRisk: destructive ? "high" : body.length > 80000 ? "medium" : "low",
    destructiveChange: destructive,
    backfillRequired: /backfill|update\s+public\./i.test(body),
    rollbackStrategy: "forward-fix only; do not delete financial/audit rows; disable via feature flags/kill switches",
    validationQuery: inferValidation(filename),
    status: "local_present",
  };
}

function inferDeps(filename) {
  if (filename.startsWith("20260803140000")) {
    return ["20260803135000_platform_account_restrictions_canonical.sql", "20260803135300_profiles_deactivated_at_canonical.sql"];
  }
  if (filename.startsWith("20260803210000")) return ["20260803173000_verification_business_platform_foundation.sql"];
  if (filename.startsWith("20260803220000")) return ["20260803210000_picom_verified_subscription_and_entitlements.sql"];
  if (filename.startsWith("20260803221951")) return ["20260803173000_verification_business_platform_foundation.sql"];
  if (filename.startsWith("20260803225000")) return ["20260803220000_business_application_verification_and_team_management.sql"];
  if (filename.startsWith("20260803230000")) return ["20260803220000_business_application_verification_and_team_management.sql"];
  if (filename.startsWith("20260803240000")) return ["20260803230000_business_catalog_brand_content_and_promotion_bridge.sql"];
  if (filename.startsWith("20260803250000")) return ["20260803240000_advertiser_campaign_delivery_and_revenue_attribution.sql"];
  if (filename.startsWith("20260803260000")) return ["20260803250000_partner_payout_tax_reconciliation_and_ad_transparency.sql"];
  if (filename.startsWith("20260803270000")) return ["20260803260000_production_feature_canary_allowlist_and_rollout_gates.sql"];
  if (filename.includes("platform_account_restrictions")) return ["profiles"];
  if (filename.includes("profiles_deactivated")) return ["profiles"];
  return [];
}

function summarizeChanged(body) {
  const tables = [...body.matchAll(/create table if not exists public\.([a-z0-9_]+)/gi)].map((m) => m[1]);
  const fns = [...body.matchAll(/create or replace function public\.([a-z0-9_]+)/gi)].map((m) => m[1]);
  return { tables: [...new Set(tables)].slice(0, 40), functions: [...new Set(fns)].slice(0, 40) };
}

function inferValidation(filename) {
  if (filename.includes("platform_account_restrictions")) {
    return "select to_regclass('public.platform_account_restrictions') is not null;";
  }
  if (filename.includes("profiles_deactivated")) {
    return "select exists (select 1 from information_schema.columns where table_name='profiles' and column_name='deactivated_at');";
  }
  if (filename.startsWith("20260803250000")) {
    return "select to_regclass('public.payout_platform_settings') is not null;";
  }
  if (filename.startsWith("20260803260000")) {
    return "select to_regclass('public.feature_canary_allowlist') is not null;";
  }
  return "select 1;";
}

function main() {
  const { releaseCommit: argCommit } = parseArgs(process.argv.slice(2));
  const releaseCommit =
    argCommit ||
    execSync("git rev-parse HEAD", { cwd: root, encoding: "utf8" }).trim();
  const branch = execSync("git branch --show-current", { cwd: root, encoding: "utf8" }).trim();

  const migrationFiles = fs
    .readdirSync(path.join(root, "supabase", "migrations"))
    .filter((f) => f.startsWith("20260803") && f.endsWith(".sql"))
    .sort();

  const migrations = migrationFiles.map(migrationMeta);
  const migrationManifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    releaseCommit,
    branch,
    environmentTarget: "production",
    migrations,
  };
  const migrationJson = `${JSON.stringify(migrationManifest, null, 2)}\n`;
  const migrationManifestSha = lfSha256(migrationJson);

  const rollout = JSON.parse(
    fs.readFileSync(path.join(root, "config", "rollout", "closed-beta.v1.json"), "utf8"),
  );

  const releaseManifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    releaseCommit,
    branch,
    environmentTarget: "production",
    stagingProjectRef: "ufmtvqtsklqsmqxefbbs",
    productionProjectRefCandidate: "cqnsetsmcduraryemhbi",
    productionMutationGuard: "BLOCKED_UNTIL_ENV_COMPLETE",
    hostedMigrationApplyStatus: "not_done",
    productionRemoteLatestMigration: "20260803221951",
    sealedMigrationRepair: {
      filename: "20260803240000_advertiser_campaign_delivery_and_revenue_attribution.sql",
      oldLfNormalizedSha256: "91b3d1990d6b3d1d46f2a89e3bf5a94da8e67b316419baa40bf17c86bfd846c9",
      newLfNormalizedSha256: "ca8f0de91b8ed06021046ce2992eac2e1fffc028f3cc909f7da3c69a79bb461e",
      exceptionDoc: "docs/release/MIGRATION_SEAL_EXCEPTION_20260803240000.md",
    },
    hostedOnlyReconciliation: {
      version: "20260803221951",
      classification: "EXACT_RECONSTRUCTABLE",
      materializedFilename: "20260803221951_live_screen_session_metadata.sql",
      lfNormalizedSha256: "87d557e440a68257b41d426552dc702b09e958600d49d819fc99c55818ed4919",
      auditDoc: "docs/release/HOSTED_MIGRATION_RECONCILIATION_20260803221951.md",
    },
    additiveViewDropMigration: {
      filename: "20260803225000_drop_foundation_public_business_views_for_catalog_rebuild.sql",
      lfNormalizedSha256: "8c0242941f4cdd9c9ae63e3d876fcdb201b71305add54ce26f7e9ce61cf7d53e",
    },
    securityHardeningMigration: {
      filename: "20260803270000_advertising_acl_role_catalog_rls_and_test_hardening.sql",
      lfNormalizedSha256: "2468189af3abf322b982c633cf07f21288ac3634c84018004ebb1c292cc680c0",
    },
    latestGateMigration: "20260803270000_advertising_acl_role_catalog_rls_and_test_hardening.sql",
    migrationFiles,
    migrationSha256List: migrations.map((m) => ({
      filename: m.filename,
      lfNormalizedSha256: m.lfNormalizedSha256,
    })),
    expectedMigrationManifestSha256: migrationManifestSha,
    edgeFunctions: listEdgeFunctions(),
    workerImageDigests: {
      "email-worker": "BLOCKED_NO_IMMUTABLE_DIGEST",
      "event-reminder-worker": "BLOCKED_NO_IMMUTABLE_DIGEST",
      "advertising-scheduler": "BLOCKED_IMAGE_NOT_BUILT",
      "ad-reconciliation-worker": "BLOCKED_IMAGE_NOT_BUILT",
      "invalid-traffic-worker": "BLOCKED_IMAGE_NOT_BUILT",
      "payout-worker": "BLOCKED_IMAGE_NOT_BUILT",
      "payout-reconciliation-worker": "BLOCKED_IMAGE_NOT_BUILT",
      "transparency-archive-worker": "BLOCKED_IMAGE_NOT_BUILT",
      "retention-cleanup-worker": "BLOCKED_IMAGE_NOT_BUILT",
    },
    webBuildArtifactHash: "NOT_COMPUTED_THIS_TASK",
    accountCenterArtifactHash: "NOT_COMPUTED_THIS_TASK",
    desktopArtifactHash: "NOT_COMPUTED_THIS_TASK",
    featureFlagDefaults: rollout.featureFlagDefaults,
    closedBetaConfigVersion: rollout.version,
  };

  const releaseJson = `${JSON.stringify(releaseManifest, null, 2)}\n`;
  const releaseManifestSha = lfSha256(releaseJson);

  fs.mkdirSync(path.join(root, "docs", "release"), { recursive: true });
  fs.writeFileSync(path.join(root, "docs", "release", "production-migration-manifest.json"), migrationJson);
  fs.writeFileSync(
    path.join(root, "docs", "release", "production-migration-manifest.sha256"),
    `${migrationManifestSha}  production-migration-manifest.json\n`,
  );
  fs.writeFileSync(path.join(root, "docs", "release", "production-release-manifest.json"), releaseJson);
  fs.writeFileSync(
    path.join(root, "docs", "release", "production-release-manifest.sha256"),
    `${releaseManifestSha}  production-release-manifest.json\n`,
  );

  console.log(`MIGRATION_MANIFEST_SHA256=${migrationManifestSha}`);
  console.log(`RELEASE_MANIFEST_SHA256=${releaseManifestSha}`);
  console.log(`RELEASE_COMMIT=${releaseCommit}`);
}

main();
