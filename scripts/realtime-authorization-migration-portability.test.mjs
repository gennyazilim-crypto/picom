/**
 * Static tests for platform-safe realtime.messages RLS guard in
 * 20260710121000_multi_tenant_realtime_storage_hardening.sql
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const migrationRel = "supabase/migrations/20260710121000_multi_tenant_realtime_storage_hardening.sql";
const migrationPath = join(root, migrationRel);
const manifestPath = join(root, "docs/publisher-creator/PUBLISHER_CREATOR_PHASE1_RELEASE_MANIFEST.json");
const LEGACY_SHA256 = "6c7fbfc4a8aac4829f2d4a6d6ae170b6ee537652991e101eb50e03e17b2d4bd8";

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function extractRealtimePolicySemantics(sql) {
  const parts = [];
  const fn = sql.match(
    /create or replace function public\.can_access_picom_realtime_topic[\s\S]*?\$\$;/i,
  );
  if (fn) parts.push(fn[0].replace(/\s+/g, " ").trim().toLowerCase());
  const policies = [
    ...sql.matchAll(/drop policy if exists[\s\S]*?;[\r\n]+create policy[\s\S]*?;/gi),
  ];
  for (const m of policies) {
    if (!/on realtime\.messages/i.test(m[0])) continue;
    parts.push(m[0].replace(/\s+/g, " ").trim().toLowerCase());
  }
  return parts.join("\n");
}

function loadGuardBody(sql) {
  const m = sql.match(/do \$picom_realtime_guard\$([\s\S]*?)\$picom_realtime_guard\$;/i);
  assert.ok(m, "picom_realtime_guard DO block missing");
  return m[1];
}

function simulateGuard({ found = true, relkind = "p", rls = true } = {}) {
  const errors = [];
  const raise = (errcode, message) => {
    const err = new Error(message);
    err.code = errcode;
    errors.push(err);
    throw err;
  };
  try {
    if (!found) {
      raise("42P01", "realtime.messages is required before PICOM realtime policies can be installed");
    }
    if (!["r", "p"].includes(relkind)) {
      raise("42809", "realtime.messages has an unexpected relation type");
    }
    if (!rls) {
      raise("55000", "realtime.messages must have platform-managed RLS enabled");
    }
    return { ok: true, errors };
  } catch (err) {
    return { ok: false, errors, err };
  }
}

const sql = readFileSync(migrationPath, "utf8");
const guard = loadGuardBody(sql);

test("guard fails when realtime.messages missing", () => {
  const r = simulateGuard({ found: false });
  assert.equal(r.ok, false);
  assert.equal(r.err.code, "42P01");
});

test("guard fails on unexpected relation type", () => {
  const r = simulateGuard({ found: true, relkind: "v", rls: true });
  assert.equal(r.ok, false);
  assert.equal(r.err.code, "42809");
});

test("guard fails when RLS disabled", () => {
  const r = simulateGuard({ found: true, relkind: "r", rls: false });
  assert.equal(r.ok, false);
  assert.equal(r.err.code, "55000");
});

test("partitioned + RLS true passes without ALTER", () => {
  const r = simulateGuard({ found: true, relkind: "p", rls: true });
  assert.equal(r.ok, true);
  assert.equal(/alter\s+table\s+realtime\.messages/i.test(sql), false);
  assert.match(guard, /relkind not in \('r', 'p'\)/i);
});

test("normal table + RLS true passes", () => {
  const r = simulateGuard({ found: true, relkind: "r", rls: true });
  assert.equal(r.ok, true);
});

test("policy SQL semantics unchanged vs legacy blob", () => {
  // Prefer sanitized ancestry SHA (filter-repo remap of original ff15f21d).
  const legacyCommitCandidates = [
    "1224c1c9f9d5f50b8da8f0e273dc54e565aea74b",
    "ff15f21d",
  ];
  let legacySql = null;
  for (const rev of legacyCommitCandidates) {
    try {
      legacySql = execFileSync(
        "git",
        ["show", `${rev}:${migrationRel}`],
        { cwd: root, encoding: "utf8" },
      );
      break;
    } catch {
      // try next candidate
    }
  }
  assert.ok(legacySql, "legacy migration blob missing from git history");
  assert.equal(sha256(legacySql.replace(/\r\n/g, "\n")), LEGACY_SHA256);
  const before = extractRealtimePolicySemantics(legacySql);
  const after = extractRealtimePolicySemantics(sql);
  assert.equal(sha256(before), sha256(after), "POLICY_SEMANTIC_HASH drift");
});

test("migration has no platform owner ALTER on realtime.messages", () => {
  assert.equal(/alter\s+table\s+realtime\.messages\s+enable\s+row\s+level\s+security/i.test(sql), false);
  assert.equal(/alter\s+table\s+realtime\.messages\s+owner/i.test(sql), false);
  assert.equal(/alter\s+schema\s+realtime/i.test(sql), false);
});

test("migration does not disable RLS", () => {
  assert.equal(/disable\s+row\s+level\s+security/i.test(sql), false);
  assert.equal(/force\s+row\s+level\s+security/i.test(sql), false);
});

test("production manifest dual-hash record is correct", () => {
  assert.ok(existsSync(manifestPath));
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const row = (manifest.historicalMigrations || []).find((m) => m.version === "20260710121000")
    || manifest.realtimeAuthorizationMigration
    || null;
  assert.ok(row, "manifest realtimeAuthorizationMigration / historical entry missing");
  assert.equal(row.legacyStagingSha256, LEGACY_SHA256);
  // Manifest records LF-normalized content so Windows CRLF checkouts still match.
  assert.equal(
    row.canonicalPortableSha256,
    sha256(readFileSync(migrationPath, "utf8").replace(/\r\n/g, "\n")),
  );
  assert.equal(row.schemaSemanticsEquivalent, true);
  assert.equal(row.stagingStatus, "APPLIED_LEGACY_EQUIVALENT");
  assert.match(String(row.productionStatus), /PENDING_APPLY|APPLIED_CANONICAL_MATCHED/);
  assert.ok(row.compatibilityAmendment);
  assert.ok(row.compatibilityReason);
  assert.ok(row.policySemanticHash);
});

test("staging legacy equivalence fields present on manifest", () => {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const row = manifest.realtimeAuthorizationMigration;
  assert.equal(row.stagingStatus, "APPLIED_LEGACY_EQUIVALENT");
  assert.equal(row.schemaSemanticsEquivalent, true);
});

console.log(`canonical_sha256=${sha256(readFileSync(migrationPath))}`);
console.log(`policy_semantic_hash=${sha256(extractRealtimePolicySemantics(sql))}`);
