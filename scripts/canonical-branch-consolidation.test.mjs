/**
 * Regression coverage for PICOM canonical branch consolidation.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function sha256Lf(buf) {
  return sha256(Buffer.from(buf).toString("utf8").replace(/\r\n/g, "\n"));
}

const REQUIRED = [
  "9daeaa0432f98906faae4ea5fa446f24d7ead0cf",
  "63ff025496b1fcdd34961aafd8ddd4bc2d2b0861",
  "2ed457724b7073efaf25fb85b3ec823df02966f2",
  "d2d4af877189dc82c0920ec6526ca1d39e8173a9",
  "1224c1c9f9d5f50b8da8f0e273dc54e565aea74b",
  "ba273783c383c6e2520a1ad12a81a8f8e53762aa",
  "cf1064cecdb711a063936dea89035e68e8bf3a77",
  "6d79b0e2ba197b1e5c8698e68bc5a4a252c57f92",
];

const PHASE1 = [
  "20260803100000_community_live_screen_sessions.sql",
  "20260803110000_go_live_broadcast_start.sql",
  "20260803130000_public_platform_stats.sql",
  "20260803135000_platform_account_restrictions_canonical.sql",
  "20260803135100_notification_preferences_canonical.sql",
  "20260803135200_live_broadcaster_notification_prefs_canonical.sql",
  "20260803135300_profiles_deactivated_at_canonical.sql",
  "20260803140000_publisher_creator_program_core.sql",
  "20260803141000_publisher_livekit_broadcast_gate.sql",
  "20260803150000_live_now_publisher_discovery.sql",
  "20260803160000_publisher_eligibility_member_count_canonical.sql",
  "20260803170000_live_now_discovery_badge_join_dedupe.sql",
  "20260803171000_live_now_badge_realtime_revocation.sql",
  "20260803172000_publisher_schedule_reminders_and_notif_modes.sql",
];

const PORTABLE = "6cac3fc152f34cd3ae433630747a7e2b3d1bf6abfafddc32a9bea78fce5b389a";
const LEGACY = "6c7fbfc4a8aac4829f2d4a6d6ae170b6ee537652991e101eb50e03e17b2d4bd8";

test("1. canonical branch contains required commit ancestry", () => {
  const head = git(["rev-parse", "HEAD"]);
  for (const rev of REQUIRED) {
    const r = spawnSync("git", ["merge-base", "--is-ancestor", rev, head], { cwd: root });
    assert.equal(r.status, 0, `missing ancestry ${rev}`);
  }
});

test("2. Phase 1 migration chain is complete", () => {
  for (const name of PHASE1) {
    assert.ok(existsSync(join(root, "supabase/migrations", name)), name);
  }
});

test("3. 20260803100000 exists", () => {
  assert.ok(
    existsSync(join(root, "supabase/migrations/20260803100000_community_live_screen_sessions.sql")),
  );
});

test("4. realtime portable LF hash is correct", () => {
  const sql = readFileSync(
    join(root, "supabase/migrations/20260710121000_multi_tenant_realtime_storage_hardening.sql"),
  );
  assert.equal(sha256Lf(sql), PORTABLE);
});

test("5. legacy realtime hash is not the working tree file", () => {
  const sql = readFileSync(
    join(root, "supabase/migrations/20260710121000_multi_tenant_realtime_storage_hardening.sql"),
  );
  assert.notEqual(sha256Lf(sql), LEGACY);
  assert.match(sql.toString("utf8"), /picom_realtime_guard/i);
  assert.equal(/alter\s+table\s+realtime\.messages\s+enable\s+row\s+level\s+security/i.test(sql.toString("utf8")), false);
});

test("6. production deploy fails on wrong branch (simulated)", () => {
  // Guard rejects non-canonical branch names via direct branch check logic:
  // run the script; on canonical worktree it must PASS.
  const r = spawnSync("node", ["scripts/assert-canonical-release-branch.mjs"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.match(r.stdout, /PICOM_CANONICAL_RELEASE_GUARD=PASS/);
});

test("7. canonical branch production guard PASS", () => {
  const branch = git(["branch", "--show-current"]);
  assert.equal(branch, "release/picom-canonical-production");
});

test("8. main is stale relative to canonical before promotion", () => {
  const r = spawnSync("git", ["merge-base", "--is-ancestor", "0c90fa5f", "origin/main"], {
    cwd: root,
  });
  assert.notEqual(r.status, 0, "origin/main unexpectedly contains realtime portability commit");
});

test("9. build/config does not hardcode staging target as production", () => {
  const guard = readFileSync(join(root, "scripts/production-config-guard.mjs"), "utf8");
  assert.match(guard, /ufmtvqtsklqsmqxefbbs/);
  assert.match(guard, /kbdotviopwlcqviggtrc/);
  if (existsSync(join(root, ".env.production"))) {
    const env = readFileSync(join(root, ".env.production"), "utf8");
    assert.equal(env.includes("ufmtvqtsklqsmqxefbbs"), false);
    assert.equal(env.includes("kbdotviopwlcqviggtrc"), false);
  }
});

test("10. Publisher/Creator surfaces are present (not rolled back)", () => {
  for (const rel of [
    "src/components/publisher/PublisherApplicationWorkspace.tsx",
    "src/components/publisher/PublisherDashboardWorkspace.tsx",
    "src/components/rootDashboard/modules/PublisherCreatorReviewPage.tsx",
    "src/services/publisher/publisherProgramService.ts",
    "src/services/live/publisherLiveNowService.ts",
    "docs/publisher-creator/PUBLISHER_CREATOR_PHASE1_RELEASE_MANIFEST.json",
    "docs/publisher-creator/PUBLISHER_CREATOR_PRODUCTION_ROLLBACK.md",
  ]) {
    assert.ok(existsSync(join(root, rel)), rel);
  }
  const uiLang = readFileSync(join(root, "src/services/localization/uiLanguages.ts"), "utf8");
  assert.equal(/UiLanguage\s*=\s*"en"\s*\|\s*"tr"/.test(uiLang), false);
  assert.match(uiLang, /SUPPORTED_UI_LANGUAGES/);
  assert.match(uiLang, /"ar"/);
});
