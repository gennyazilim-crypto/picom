import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const guard = path.join(root, "scripts", "production-config-guard.mjs");

function runGuard(envFileContents, extraEnv = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "picom-prod-guard-"));
  const envPath = path.join(dir, ".env.production");
  fs.writeFileSync(envPath, envFileContents, "utf8");
  const result = spawnSync(process.execPath, [guard, `--strict-env-file=${envPath}`], {
    cwd: root,
    env: { ...process.env, ...extraEnv, PICOM_FORCE_PRODUCTION_GUARD: "1" },
    encoding: "utf8",
  });
  return { status: result.status ?? 1, stdout: result.stdout || "", stderr: result.stderr || "" };
}

test("production guard PASS for distinct production placeholder-free URL", () => {
  const { status, stdout, stderr } = runGuard(
    [
      "VITE_APP_ENV=production",
      "VITE_SUPABASE_URL=https://abcdefghijklmnop.supabase.co",
      "VITE_SUPABASE_ANON_KEY=test-anon-not-a-real-secret",
    ].join("\n"),
  );
  assert.equal(status, 0, stderr);
  assert.match(stdout, /PICOM_PRODUCTION_CONFIG_GUARD=PASS/);
});

test("production guard FAIL on staging ufmt ref", () => {
  const { status, stderr } = runGuard(
    [
      "VITE_APP_ENV=production",
      "VITE_SUPABASE_URL=https://ufmtvqtsklqsmqxefbbs.supabase.co",
      "VITE_SUPABASE_ANON_KEY=test-anon",
    ].join("\n"),
  );
  assert.equal(status, 1);
  assert.match(stderr, /PRODUCTION_CONFIG_INVALID_STAGING_TARGET/);
});

test("production guard FAIL on staging-v2 kbd ref", () => {
  const { status, stderr } = runGuard(
    [
      "VITE_APP_ENV=production",
      "VITE_SUPABASE_URL=https://kbdotviopwlcqviggtrc.supabase.co",
      "VITE_SUPABASE_ANON_KEY=test-anon",
    ].join("\n"),
  );
  assert.equal(status, 1);
  assert.match(stderr, /PRODUCTION_CONFIG_INVALID_STAGING_TARGET/);
});

test("production guard FAIL on YOUR_PRODUCTION placeholder", () => {
  const { status, stderr } = runGuard(
    [
      "VITE_APP_ENV=production",
      "VITE_SUPABASE_URL=https://YOUR_PRODUCTION_PROJECT.supabase.co",
      "VITE_SUPABASE_ANON_KEY=YOUR_PRODUCTION_ANON_KEY",
    ].join("\n"),
  );
  assert.equal(status, 1);
  assert.match(stderr, /PRODUCTION_CONFIG_PLACEHOLDER_SUPABASE_URL/);
});

test("non-production mode skips when not forced", () => {
  const result = spawnSync(process.execPath, [guard], {
    cwd: root,
    env: { ...process.env, MODE: "development", VITE_APP_ENV: "development", PICOM_FORCE_PRODUCTION_GUARD: "" },
    encoding: "utf8",
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout || "", /PICOM_PRODUCTION_CONFIG_GUARD=SKIP/);
});
