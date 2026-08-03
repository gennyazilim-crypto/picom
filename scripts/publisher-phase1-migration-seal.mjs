/**
 * Seal Publisher/Creator Phase 1 migration history on canonical staging only.
 * Read-mostly: queries schema_migrations + object existence. Does not repair history.
 *
 *   powershell -File scripts/with-supabase-cli-token.ps1 node scripts/publisher-phase1-migration-seal.mjs --run
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const shouldRun = process.argv.includes("--run");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRef = "ufmtvqtsklqsmqxefbbs";
const migrationsDir = path.join(root, "supabase", "migrations");

const CHAIN = [
  "20260803130000_public_platform_stats.sql",
  "20260803140000_publisher_creator_program_core.sql",
  "20260803141000_publisher_livekit_broadcast_gate.sql",
  "20260803150000_live_now_publisher_discovery.sql",
  "20260803160000_publisher_eligibility_member_count_canonical.sql",
  "20260803170000_live_now_discovery_badge_join_dedupe.sql",
  "20260803171000_live_now_badge_realtime_revocation.sql",
  "20260803172000_publisher_schedule_reminders_and_notif_modes.sql",
];

if (!shouldRun) {
  console.log("publisher-phase1-migration-seal BLOCKED until --run");
  process.exit(0);
}

function sha256File(filePath) {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function runSql(sql) {
  const tmpName = `.tmp-migration-seal-${process.pid}.sql`;
  const tmp = path.join(root, tmpName);
  fs.writeFileSync(tmp, sql, "utf8");
  try {
    const args = ["supabase", "db", "query", "--linked", "-f", tmpName, "-o", "json"];
    const out = process.platform === "win32"
      ? execFileSync("cmd.exe", ["/d", "/s", "/c", `npx supabase db query --linked -f ${tmpName} -o json`], {
        cwd: root,
        encoding: "utf8",
        env: process.env,
        maxBuffer: 8 * 1024 * 1024,
      })
      : execFileSync("npx", args, {
        cwd: root,
        encoding: "utf8",
        env: process.env,
        maxBuffer: 8 * 1024 * 1024,
      });
    return out;
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
}

function parseJsonPayload(raw) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error(`JSON_PARSE_FAIL:${raw.slice(0, 200)}`);
  return JSON.parse(raw.slice(start, end + 1));
}

const inventory = CHAIN.map((filename) => {
  const full = path.join(migrationsDir, filename);
  if (!fs.existsSync(full)) throw new Error(`MISSING_FILE ${filename}`);
  const version = filename.slice(0, 14);
  return { version, filename, hash: sha256File(full) };
});

const versions = inventory.map((row) => row.version);
const versionList = versions.map((v) => `'${v}'`).join(",");

const historyRaw = runSql(
  `select version from supabase_migrations.schema_migrations where version in (${versionList}) order by version;`,
);
const historyPayload = parseJsonPayload(historyRaw);
const historyVersions = new Set(
  (historyPayload.rows || []).map((row) => String(row.version)),
);

const objectsRaw = runSql(`
select
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='authorize_live_broadcast_livekit') as authorize_live_broadcast_livekit,
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='list_publisher_live_now') as list_publisher_live_now,
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='count_publisher_live_now') as count_publisher_live_now,
  exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='largest_owned_active_community_stats') as largest_owned_active_community_stats,
  (to_regclass('public.publisher_stream_schedule_reminders') is not null) as publisher_stream_schedule_reminders,
  (to_regclass('public.publisher_badges') is not null) as publisher_badges,
  (to_regclass('public.publisher_profiles') is not null) as publisher_profiles,
  exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='publisher_badges') as realtime_badges;
`);

const objectFlags = parseJsonPayload(objectsRaw).rows?.[0] || {};

const rows = inventory.map((row) => {
  const inHistory = historyVersions.has(row.version);
  let status = "MISSING";
  if (row.version === "20260803141000") {
    const obj = objectFlags.authorize_live_broadcast_livekit === true;
    if (inHistory && obj) status = "APPLIED_AND_MATCHED";
    else if (inHistory && !obj) status = "HISTORY_ONLY";
    else if (!inHistory && obj) status = "OBJECTS_ONLY";
    else status = "MISSING";
  } else if (inHistory) {
    status = "APPLIED_AND_MATCHED";
  }
  return { ...row, inHistory, status };
});

const summary = {
  projectRef,
  inventory: rows,
  objectFlags,
  allMatched: rows.every((r) => r.status === "APPLIED_AND_MATCHED"),
  allObjectsPresent: Object.values(objectFlags).every((v) => v === true),
};

console.log(JSON.stringify(summary, null, 2));
if (!summary.allMatched || !summary.allObjectsPresent) {
  console.error("MIGRATION_SEAL=FAIL");
  process.exit(1);
}
console.log("MIGRATION_SEAL=PASS");
process.exit(0);
