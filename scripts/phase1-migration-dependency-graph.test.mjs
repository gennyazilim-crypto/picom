/**
 * Static missing-table dependency scan for Phase 1 pending migrations.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const dir = join(root, "supabase/migrations");

function createdObjects() {
  const created = new Map();
  const createTable = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-zA-Z0-9_]+)/gi;
  const createView = /create\s+(?:or\s+replace\s+)?view\s+(?:public\.)?([a-zA-Z0-9_]+)/gi;
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) {
    const sql = readFileSync(join(dir, f), "utf8");
    for (const re of [createTable, createView]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(sql))) created.set(m[1].toLowerCase(), f);
    }
  }
  return created;
}

function usedTables(pendingFiles) {
  const used = new Map();
  const tableRef = /\b(?:from|join|into|update|references|alter\s+table)\s+public\.([a-z0-9_]+)/gi;
  for (const f of pendingFiles) {
    const sql = readFileSync(join(dir, f), "utf8");
    tableRef.lastIndex = 0;
    let m;
    while ((m = tableRef.exec(sql))) {
      const name = m[1].toLowerCase();
      if (!used.has(name)) used.set(name, new Set());
      used.get(name).add(f);
    }
  }
  return used;
}

test("pending Phase1 table creators exist before first consumer", () => {
  const all = readdirSync(dir).filter((n) => n.endsWith(".sql")).sort();
  const pending = all.filter((f) => f >= "20260803140000" && f.startsWith("20260803") && f < "20260803173000");
  const created = createdObjects();
  const used = usedTables(pending);
  const falsePositives = new Set(["largest_owned_active_community_stats"]);
  const missing = [];
  for (const [obj, files] of used) {
    if (falsePositives.has(obj)) continue;
    const creator = created.get(obj);
    if (!creator) {
      missing.push(`${obj} <- ${[...files].join(",")}`);
      continue;
    }
    const firstConsumer = [...files].sort()[0];
    if (creator > firstConsumer) {
      missing.push(`${obj} created ${creator} after consumer ${firstConsumer}`);
    }
  }
  assert.deepEqual(missing, [], missing.join("\n"));
});

test("platform_account_restrictions predecessor exists at 20260803135000", () => {
  const file = "20260803135000_platform_account_restrictions_canonical.sql";
  assert.ok(existsSync(join(dir, file)));
  const sql = readFileSync(join(dir, file), "utf8");
  assert.match(sql, /SOURCE_MIGRATION:\s*NOT_FOUND_IN_GIT_HISTORY/);
  assert.match(sql, /CANONICAL_SOURCE:\s*STAGING_SCHEMA_INTROSPECTION/);
  assert.match(sql, /create table if not exists public\.platform_account_restrictions/i);
  assert.match(sql, /temporarily_banned/);
  assert.match(sql, /expires_at/);
  assert.match(sql, /restricted_until/);
});

test("profiles.deactivated_at predecessor exists at 20260803135300 before 140000", () => {
  const file = "20260803135300_profiles_deactivated_at_canonical.sql";
  assert.ok(existsSync(join(dir, file)));
  assert.ok(file < "20260803140000_publisher_creator_program_core.sql");
  const sql = readFileSync(join(dir, file), "utf8");
  assert.match(sql, /SOURCE_MIGRATION:\s*NOT_FOUND_IN_GIT_HISTORY/);
  assert.match(sql, /CANONICAL_SOURCE:\s*STAGING_SCHEMA_INTROSPECTION/);
  assert.match(sql, /COMPATIBILITY_VERSION:\s*20260803135300/);
  assert.match(sql, /add column if not exists deactivated_at timestamptz null/i);
  assert.match(sql, /PROFILES_DEACTIVATED_AT_INCOMPATIBLE_SCHEMA/);
  assert.match(sql, /Soft deactivation timestamp/);
});
