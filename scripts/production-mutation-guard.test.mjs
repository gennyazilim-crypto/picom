import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const guard = path.join(root, "scripts", "production-mutation-guard.mjs");

function run(extraEnv = {}) {
  return spawnSync(process.execPath, [guard], {
    cwd: root,
    env: { ...process.env, ...extraEnv },
    encoding: "utf8",
  });
}

const complete = {
  PICOM_ENVIRONMENT: "production",
  SUPABASE_PRODUCTION_PROJECT_REF: "cqnsetsmcduraryemhbi",
  SUPABASE_PRODUCTION_URL: "https://cqnsetsmcduraryemhbi.supabase.co",
  SUPABASE_PRODUCTION_DB_HOST: "db.cqnsetsmcduraryemhbi.supabase.co",
  SUPABASE_PRODUCTION_ORG_ID: "agmihvcqyshjgwjgknor",
  SUPABASE_ACCESS_TOKEN: "test-token-not-logged",
  PRODUCTION_CHANGE_TICKET: "CHG-TEST-001",
  PRODUCTION_DEPLOY_APPROVED: "true",
  EXPECTED_RELEASE_COMMIT: "abc123",
  EXPECTED_MIGRATION_MANIFEST_SHA256: "deadbeef",
  SUPABASE_STAGING_PROJECT_REF: "ufmtvqtsklqsmqxefbbs",
};

test("mutation guard BLOCKED when required vars missing", () => {
  const result = run({
    PICOM_ENVIRONMENT: "",
    SUPABASE_PRODUCTION_PROJECT_REF: "",
    SUPABASE_PRODUCTION_URL: "",
    SUPABASE_PRODUCTION_DB_HOST: "",
    SUPABASE_PRODUCTION_ORG_ID: "",
    SUPABASE_ACCESS_TOKEN: "",
    PICOM_CI_SUPABASE_IDENTITY: "",
    PRODUCTION_CHANGE_TICKET: "",
    PRODUCTION_DEPLOY_APPROVED: "",
    EXPECTED_RELEASE_COMMIT: "",
    EXPECTED_MIGRATION_MANIFEST_SHA256: "",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr || "", /HOSTED_PRODUCTION_MUTATION=BLOCKED/);
  assert.match(result.stderr || "", /MISSING_PICOM_ENVIRONMENT/);
});

test("mutation guard FATAL when production ref equals staging", () => {
  const result = run({
    ...complete,
    SUPABASE_PRODUCTION_PROJECT_REF: "ufmtvqtsklqsmqxefbbs",
    SUPABASE_PRODUCTION_URL: "https://ufmtvqtsklqsmqxefbbs.supabase.co",
    SUPABASE_PRODUCTION_DB_HOST: "db.ufmtvqtsklqsmqxefbbs.supabase.co",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr || "", /FATAL_PRODUCTION_AND_STAGING_PROJECT_REFERENCES_MATCH/);
});

test("mutation guard ALLOWED when complete and distinct", () => {
  const result = run(complete);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout || "", /HOSTED_PRODUCTION_MUTATION=ALLOWED/);
});
