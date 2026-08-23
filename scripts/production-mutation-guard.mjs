/**
 * Fail-closed hosted production mutation gate.
 * Blocks apply/deploy/worker start unless every required control is present
 * and staging/production project refs are distinct.
 *
 * Does not print secret values — only presence and classification codes.
 *
 * Usage:
 *   node scripts/production-mutation-guard.mjs
 *   node scripts/production-mutation-guard.mjs --expected-commit=<sha> --expected-manifest-sha=<sha>
 */
import process from "node:process";

const STAGING_REFS = Object.freeze(["ufmtvqtsklqsmqxefbbs", "kbdotviopwlcqviggtrc"]);

const REQUIRED = Object.freeze([
  "PICOM_ENVIRONMENT",
  "SUPABASE_PRODUCTION_PROJECT_REF",
  "SUPABASE_PRODUCTION_URL",
  "SUPABASE_PRODUCTION_DB_HOST",
  "SUPABASE_PRODUCTION_ORG_ID",
  "PRODUCTION_CHANGE_TICKET",
  "PRODUCTION_DEPLOY_APPROVED",
  "EXPECTED_RELEASE_COMMIT",
  "EXPECTED_MIGRATION_MANIFEST_SHA256",
]);

function parseArgs(argv) {
  const out = { expectedCommit: null, expectedManifestSha: null };
  for (const arg of argv) {
    if (arg.startsWith("--expected-commit=")) out.expectedCommit = arg.slice("--expected-commit=".length);
    if (arg.startsWith("--expected-manifest-sha=")) {
      out.expectedManifestSha = arg.slice("--expected-manifest-sha=".length);
    }
  }
  return out;
}

function present(name) {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const errors = [];

  for (const key of REQUIRED) {
    if (!present(key)) errors.push(`MISSING_${key}`);
  }

  // Access token OR CI identity — either is acceptable; both missing is blocked.
  if (!present("SUPABASE_ACCESS_TOKEN") && !present("PICOM_CI_SUPABASE_IDENTITY")) {
    errors.push("MISSING_SUPABASE_ACCESS_TOKEN_OR_CI_IDENTITY");
  }

  const envName = String(process.env.PICOM_ENVIRONMENT || "").trim().toLowerCase();
  if (present("PICOM_ENVIRONMENT") && envName !== "production") {
    errors.push("PICOM_ENVIRONMENT_NOT_PRODUCTION");
  }

  const approved = String(process.env.PRODUCTION_DEPLOY_APPROVED || "").trim().toLowerCase();
  if (present("PRODUCTION_DEPLOY_APPROVED") && approved !== "true") {
    errors.push("PRODUCTION_DEPLOY_APPROVED_NOT_TRUE");
  }

  const prodRef = String(process.env.SUPABASE_PRODUCTION_PROJECT_REF || "").trim();
  if (prodRef && STAGING_REFS.includes(prodRef)) {
    errors.push("FATAL_PRODUCTION_AND_STAGING_PROJECT_REFERENCES_MATCH");
  }

  const stagingRef = String(process.env.SUPABASE_STAGING_PROJECT_REF || "ufmtvqtsklqsmqxefbbs").trim();
  if (prodRef && stagingRef && prodRef === stagingRef) {
    errors.push("FATAL_PRODUCTION_AND_STAGING_PROJECT_REFERENCES_MATCH");
  }

  const prodUrl = String(process.env.SUPABASE_PRODUCTION_URL || "");
  if (prodRef && prodUrl && !prodUrl.includes(prodRef)) {
    errors.push("PRODUCTION_URL_REF_MISMATCH");
  }
  if (STAGING_REFS.some((ref) => prodUrl.includes(ref))) {
    errors.push("PRODUCTION_URL_POINTS_AT_STAGING");
  }

  const dbHost = String(process.env.SUPABASE_PRODUCTION_DB_HOST || "");
  if (prodRef && dbHost && !dbHost.includes(prodRef)) {
    errors.push("PRODUCTION_DB_HOST_REF_MISMATCH");
  }
  if (STAGING_REFS.some((ref) => dbHost.includes(ref))) {
    errors.push("PRODUCTION_DB_HOST_POINTS_AT_STAGING");
  }

  const expectedCommit = String(process.env.EXPECTED_RELEASE_COMMIT || "").trim();
  if (args.expectedCommit && expectedCommit && args.expectedCommit !== expectedCommit) {
    errors.push("EXPECTED_RELEASE_COMMIT_MISMATCH");
  }

  const expectedManifest = String(process.env.EXPECTED_MIGRATION_MANIFEST_SHA256 || "").trim().toLowerCase();
  if (args.expectedManifestSha && expectedManifest && args.expectedManifestSha.toLowerCase() !== expectedManifest) {
    errors.push("EXPECTED_MIGRATION_MANIFEST_SHA256_MISMATCH");
  }

  if (errors.length) {
    console.error("HOSTED_PRODUCTION_MUTATION=BLOCKED");
    for (const code of [...new Set(errors)]) {
      console.error(`CODE=${code}`);
    }
    process.exit(1);
  }

  console.log("HOSTED_PRODUCTION_MUTATION=ALLOWED");
  console.log(`PRODUCTION_PROJECT_REF=${prodRef}`);
  console.log(`EXPECTED_RELEASE_COMMIT=${expectedCommit}`);
  console.log(`EXPECTED_MIGRATION_MANIFEST_SHA256=${expectedManifest}`);
  process.exit(0);
}

main();
