/**
 * Static tests for restored live-screen dependency migrations.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const F100 = "supabase/migrations/20260803100000_community_live_screen_sessions.sql";
const F110 = "supabase/migrations/20260803110000_go_live_broadcast_start.sql";
const SHA100 = "70a2d2a347bb4c19049b61b17ba58a38a6b768373de897499d73dd1f9dec69ee";
const SHA110 = "899834c48af8123087955e2a9eced9d5842fcf5298a1ade52acd5441f987b1b4";
const MANIFEST = "docs/publisher-creator/PUBLISHER_CREATOR_PHASE1_RELEASE_MANIFEST.json";

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function gitShow(rev, path) {
  return execFileSync("git", ["show", `${rev}:${path}`]);
}

test("current branch includes 20260803100000 migration", () => {
  assert.equal(existsSync(join(ROOT, F100)), true);
});

test("no version collision for 20260803100000 / 20260803110000", () => {
  const files = readdirSync(join(ROOT, "supabase/migrations"));
  assert.equal(files.filter((f) => f.startsWith("20260803100000")).length, 1);
  assert.equal(files.filter((f) => f.startsWith("20260803110000")).length, 1);
});

test("restored 20260803100000 hash matches source commit", () => {
  const disk = readFileSync(join(ROOT, F100));
  const src = gitShow("3d54872d", F100);
  assert.equal(sha256(disk), SHA100);
  assert.equal(sha256(src), SHA100);
  assert.deepEqual(disk, src);
});

test("restored 20260803110000 hash matches source commit", () => {
  const disk = readFileSync(join(ROOT, F110));
  const src = gitShow("442d999d", F110);
  assert.equal(sha256(disk), SHA110);
  assert.equal(sha256(src), SHA110);
  assert.deepEqual(disk, src);
});

test("20260803100000 creates community_live_screen_sessions", () => {
  const sql = readFileSync(join(ROOT, F100), "utf8");
  assert.match(sql, /create table if not exists public\.community_live_screen_sessions/i);
});

test("20260803140000 depends on live sessions + go-live columns", () => {
  const f = readdirSync(join(ROOT, "supabase/migrations")).find((x) =>
    x.startsWith("20260803140000"),
  );
  assert.ok(f);
  const sql = readFileSync(join(ROOT, "supabase/migrations", f), "utf8");
  assert.match(sql, /community_live_screen_sessions/);
  assert.match(sql, /visibility_mode|client_request_id|'starting'/);
});

test("restored migrations have no destructive DDL / seeds", () => {
  for (const path of [F100, F110]) {
    const sql = readFileSync(join(ROOT, path), "utf8");
    assert.equal(/\bdrop\s+table\b/i.test(sql), false);
    assert.equal(/\btruncate\b/i.test(sql), false);
    assert.equal(/disable\s+row\s+level\s+security/i.test(sql), false);
    assert.equal(/\bowner\s+to\b/i.test(sql), false);
    assert.equal(/^insert\s+into\b/im.test(sql), false);
  }
});

test("20260803100000 enables RLS", () => {
  const sql = readFileSync(join(ROOT, F100), "utf8");
  assert.match(sql, /alter table public\.community_live_screen_sessions enable row level security/i);
  assert.match(sql, /create policy community_live_screen_sessions_select/i);
});

test("SECURITY DEFINER functions set search_path", () => {
  for (const path of [F100, F110]) {
    const sql = readFileSync(join(ROOT, path), "utf8");
    const sec = (sql.match(/security\s+definer/gi) || []).length;
    const sp = (sql.match(/set\s+search_path/gi) || []).length;
    assert.ok(sec > 0);
    assert.equal(sec, sp);
  }
});

test("phase1 dependency graph predecessors present", () => {
  const files = readdirSync(join(ROOT, "supabase/migrations"));
  assert.ok(files.some((f) => f.startsWith("20260803100000")));
  assert.ok(files.some((f) => f.startsWith("20260803110000")));
  assert.ok(files.some((f) => f.startsWith("20260803140000")));
});

test("release manifest records restored dependency hashes", () => {
  const manifest = JSON.parse(readFileSync(join(ROOT, MANIFEST), "utf8"));
  const deps = manifest.liveScreenDependencies || [];
  const d100 = deps.find((d) => d.version === "20260803100000");
  const d110 = deps.find((d) => d.version === "20260803110000");
  assert.ok(d100);
  assert.ok(d110);
  assert.equal(d100.sha256, SHA100);
  assert.equal(d110.sha256, SHA110);
  assert.ok(
    ["PENDING_OUT_OF_ORDER_CANONICAL_APPLY", "APPLIED_OUT_OF_ORDER_CANONICAL_MATCHED"].includes(
      d100.productionStatus,
    ),
  );
  assert.equal(d100.productionStatus, d110.productionStatus);
});

test("inventory notes staging history gap for base live migrations", () => {
  const manifest = JSON.parse(readFileSync(join(ROOT, MANIFEST), "utf8"));
  assert.equal(manifest.liveScreenDependencies?.[0]?.canonicalStagingStatus, "SCHEMA_MATCHED_HISTORY_GAP");
});
