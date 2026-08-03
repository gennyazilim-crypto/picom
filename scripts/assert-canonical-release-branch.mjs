/**
 * Fail-closed guard: production build/migrate/deploy only from the canonical
 * PICOM release branch (or main after promotion), or a verified production tag.
 *
 * Usage:
 *   node scripts/assert-canonical-release-branch.mjs
 *   node scripts/assert-canonical-release-branch.mjs --allow-main-after-promotion
 *
 * Prints PICOM_CANONICAL_RELEASE_GUARD=PASS|BLOCKED_* and exits 0/1.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

const CANONICAL_BRANCH = "release/picom-canonical-production";
const ALLOWED_BRANCHES = new Set([CANONICAL_BRANCH, "main"]);

const REQUIRED_ANCESTRY = Object.freeze([
  ["76d0439b", "76d0439bf1eda8e5a208b26452b390f8690244b2"],
  ["44873669", "448736697acf44e36887740b613c1dab16df2c27"],
  ["c50f51a8", "c50f51a88c5dd841cb8c71304e6653d0b3ef6607"],
  ["21b9e089", "21b9e089"],
  ["ff15f21d", "ff15f21d"],
  ["0c90fa5f", "0c90fa5f"],
  ["23af140f", "23af140f"],
  ["3d54872d", "3d54872d"],
]);

const PHASE1_MIGRATIONS = Object.freeze([
  "20260803100000_community_live_screen_sessions.sql",
  "20260803110000_go_live_broadcast_start.sql",
  "20260803130000_public_platform_stats.sql",
  "20260803135000_platform_account_restrictions_canonical.sql",
  "20260803135100_notification_preferences_canonical.sql",
  "20260803135200_live_broadcaster_notification_prefs_canonical.sql",
  "20260803140000_publisher_creator_program_core.sql",
  "20260803141000_publisher_livekit_broadcast_gate.sql",
  "20260803150000_live_now_publisher_discovery.sql",
  "20260803160000_publisher_eligibility_member_count_canonical.sql",
  "20260803170000_live_now_discovery_badge_join_dedupe.sql",
  "20260803171000_live_now_badge_realtime_revocation.sql",
  "20260803172000_publisher_schedule_reminders_and_notif_modes.sql",
]);

const REALTIME_REL = "supabase/migrations/20260710121000_multi_tenant_realtime_storage_hardening.sql";
const PORTABLE_LF_SHA256 = "6cac3fc152f34cd3ae433630747a7e2b3d1bf6abfafddc32a9bea78fce5b389a";
const LEGACY_LF_SHA256 = "6c7fbfc4a8aac4829f2d4a6d6ae170b6ee537652991e101eb50e03e17b2d4bd8";
const MANIFEST_REL = "docs/publisher-creator/PUBLISHER_CREATOR_PHASE1_RELEASE_MANIFEST.json";
const CONFIG_GUARD_REL = "scripts/production-config-guard.mjs";
const FORBIDDEN_STAGING_REFS = Object.freeze(["ufmtvqtsklqsmqxefbbs", "kbdotviopwlcqviggtrc"]);

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function sha256Lf(buf) {
  return createHash("sha256").update(Buffer.from(buf).toString("utf8").replace(/\r\n/g, "\n")).digest("hex");
}

function block(code, detail) {
  console.error(`PICOM_CANONICAL_RELEASE_GUARD=${code}`);
  if (detail) console.error(detail);
  process.exit(1);
}

function resolveBranch() {
  let branch = "";
  try {
    branch = git(["branch", "--show-current"]);
  } catch {
    branch = "";
  }
  if (branch) return { branch, detached: false };

  // Detached HEAD: allow only annotated tags whose name starts with picom-canonical-production
  // or picom-publisher-phase1-production-candidate.
  let head = "";
  try {
    head = git(["rev-parse", "HEAD"]);
  } catch {
    block("BLOCKED_WRONG_BRANCH", "Unable to resolve HEAD");
  }
  let names = "";
  try {
    names = git(["tag", "--points-at", head]);
  } catch {
    names = "";
  }
  const tags = names.split(/\r?\n/).filter(Boolean);
  const verified = tags.filter(
    (t) =>
      t.startsWith("picom-canonical-production-")
      || t.startsWith("picom-publisher-phase1-production-candidate-"),
  );
  if (!verified.length) {
    block(
      "BLOCKED_WRONG_BRANCH",
      `Detached HEAD ${head.slice(0, 12)} is not a verified production tag`,
    );
  }
  return { branch: `detached@${verified[0]}`, detached: true, tag: verified[0], head };
}

function assertAncestry(head) {
  const missing = [];
  for (const [label, rev] of REQUIRED_ANCESTRY) {
    try {
      execFileSync("git", ["merge-base", "--is-ancestor", rev, head], { cwd: root, stdio: "ignore" });
    } catch {
      missing.push(label);
    }
  }
  if (missing.length) {
    block("BLOCKED_MISSING_HISTORY", `Missing required commit ancestry: ${missing.join(", ")}`);
  }
}

function assertMigrations() {
  for (const name of PHASE1_MIGRATIONS) {
    const p = join(root, "supabase/migrations", name);
    if (!existsSync(p)) block("BLOCKED_MISSING_MIGRATION", `Missing ${name}`);
  }
  const live = join(root, "supabase/migrations/20260803100000_community_live_screen_sessions.sql");
  if (!existsSync(live)) block("BLOCKED_MISSING_MIGRATION", "Missing 20260803100000");
  const goLive = join(root, "supabase/migrations/20260803110000_go_live_broadcast_start.sql");
  if (!existsSync(goLive)) block("BLOCKED_MISSING_MIGRATION", "Missing 20260803110000");
  const par = join(root, "supabase/migrations/20260803135000_platform_account_restrictions_canonical.sql");
  if (!existsSync(par)) {
    block("BLOCKED_MISSING_PREDECESSOR", "Missing platform_account_restrictions predecessor 20260803135000");
  }
  const parSql = readFileSync(par, "utf8");
  if (!/create\s+table\s+if\s+not\s+exists\s+public\.platform_account_restrictions/i.test(parSql)) {
    block("BLOCKED_MISSING_PREDECESSOR", "20260803135000 does not create public.platform_account_restrictions");
  }

  const rtPath = join(root, REALTIME_REL);
  if (!existsSync(rtPath)) block("BLOCKED_MISSING_MIGRATION", `Missing ${REALTIME_REL}`);
  const hash = sha256Lf(readFileSync(rtPath));
  if (hash === LEGACY_LF_SHA256) {
    block("BLOCKED_LEGACY_REALTIME_MIGRATION", "Realtime migration reverted to legacy staging blob");
  }
  if (hash !== PORTABLE_LF_SHA256) {
    block(
      "BLOCKED_REALTIME_HASH_MISMATCH",
      `Expected portable LF sha256 ${PORTABLE_LF_SHA256}, got ${hash}`,
    );
  }
}

function assertManifestAndGuards() {
  if (!existsSync(join(root, MANIFEST_REL))) {
    block("BLOCKED_MISSING_MANIFEST", `Missing ${MANIFEST_REL}`);
  }
  if (!existsSync(join(root, CONFIG_GUARD_REL))) {
    block("BLOCKED_MISSING_CONFIG_GUARD", `Missing ${CONFIG_GUARD_REL}`);
  }
  const envPath = join(root, ".env.production");
  if (existsSync(envPath)) {
    const raw = readFileSync(envPath, "utf8");
    for (const ref of FORBIDDEN_STAGING_REFS) {
      if (raw.includes(ref)) {
        block("BLOCKED_STAGING_IN_PRODUCTION_CONFIG", `Staging project ref ${ref} found in .env.production`);
      }
    }
  }
}

function main() {
  const { branch, detached } = resolveBranch();
  if (!detached && !ALLOWED_BRANCHES.has(branch)) {
    block(
      "BLOCKED_WRONG_BRANCH",
      `Branch '${branch}' is not allowed. Use ${CANONICAL_BRANCH} (or main after promotion).`,
    );
  }

  // main is allowed only when it already contains the realtime portability fix
  // (i.e. after canonical promotion). Before that, main is stale.
  let head = "";
  try {
    head = git(["rev-parse", "HEAD"]);
  } catch {
    block("BLOCKED_WRONG_BRANCH", "Unable to resolve HEAD");
  }

  if (!detached && branch === "main") {
    try {
      execFileSync("git", ["merge-base", "--is-ancestor", "0c90fa5f", head], {
        cwd: root,
        stdio: "ignore",
      });
    } catch {
      block(
        "BLOCKED_WRONG_BRANCH",
        "main is stale and has not received the canonical production baseline yet",
      );
    }
  }

  assertAncestry(head);
  assertMigrations();
  assertManifestAndGuards();

  console.log("PICOM_CANONICAL_RELEASE_GUARD=PASS");
  console.log(`branch=${branch}`);
  console.log(`head=${head}`);
}

main();
