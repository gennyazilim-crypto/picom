import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const isSmoke = args.includes("--smoke");
const execute = args.includes("--execute");
const backupIndex = args.indexOf("--backup");
const backupPath = backupIndex >= 0 ? args[backupIndex + 1] : undefined;
const TEMP_PREFIX = "picom_restore_verify_";

function fail(message) { console.error(`FAIL: ${message}`); process.exit(1); }
function run(command, commandArgs, env, capture = false) { const result = spawnSync(command, commandArgs, { env, encoding: "utf8", stdio: capture ? "pipe" : "inherit", shell: false }); if (result.error) throw result.error; if (result.status !== 0) throw new Error(`${command} failed with exit code ${result.status}${capture && result.stderr ? `: ${result.stderr.trim().slice(0, 400)}` : ""}`); return capture ? result.stdout.trim() : ""; }
function toolAvailable(command) { const result = spawnSync(command, ["--version"], { encoding: "utf8", stdio: "ignore", shell: false }); return !result.error && result.status === 0; }

if (isSmoke) {
  const doc = fs.readFileSync("docs/backup-verification.md", "utf8");
  const script = fs.readFileSync(new URL(import.meta.url), "utf8");
  const required = ["temporary development or staging database", "PICOM_BACKUP_VERIFY_CONFIRM", "staging-only", "createdb", "pg_restore", "psql", "dropdb", "integrity checks", "manual fallback", "Do not run against production"];
  const missing = required.filter((item) => !`${doc}\n${script}`.toLowerCase().includes(item.toLowerCase()));
  if (missing.length) fail(`backup verification contract is missing: ${missing.join(", ")}`);
  if (!script.includes("finally") || !script.includes("TEMP_PREFIX") || !script.includes("PICOM_BACKUP_VERIFY_SOURCE")) fail("cleanup/source safety markers are missing");
  console.log("PASS: backup restore verification automation safety contract is present; no database was opened.");
  process.exit(0);
}

console.log("Picom backup restore verification");
if (!execute) {
  console.log("Safe plan mode. No database is opened.");
  console.log("Usage: npm run backup:verify:automated -- --backup path/to/staging.dump --execute");
  process.exit(0);
}

if (!backupPath) fail("--backup is required in execute mode");
const absoluteBackup = path.resolve(backupPath);
if (!fs.existsSync(absoluteBackup) || !fs.statSync(absoluteBackup).isFile()) fail("backup file does not exist or is not a file");
if (process.env.PICOM_BACKUP_VERIFY_CONFIRM !== "staging-temporary-restore") fail("PICOM_BACKUP_VERIFY_CONFIRM=staging-temporary-restore is required");
if (process.env.PICOM_BACKUP_VERIFY_SOURCE !== "staging") fail("PICOM_BACKUP_VERIFY_SOURCE=staging is required");

const host = (process.env.PGHOST ?? "127.0.0.1").trim().toLowerCase();
const database = (process.env.PGDATABASE ?? "postgres").trim().toLowerCase();
const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);
const stagingNamedHost = /(?:^|[.-])(?:staging|stage|test|dev)(?:[.-]|$)/i.test(host);
if (/prod|production/i.test(`${host} ${database}`)) fail("production-like host/database is forbidden");
if (!localHosts.has(host) && !(process.env.PICOM_BACKUP_VERIFY_ALLOW_STAGING === "true" && stagingNamedHost)) fail("remote host is forbidden unless explicitly allowed and staging/test/dev named");
if (!["postgres", "template1"].includes(database)) fail("PGDATABASE must be postgres or template1 maintenance database");

for (const tool of ["createdb", "psql", "dropdb"]) if (!toolAvailable(tool)) fail(`${tool} is unavailable; use the documented manual fallback`);
const sqlBackup = absoluteBackup.toLowerCase().endsWith(".sql");
if (!sqlBackup && !toolAvailable("pg_restore")) fail("pg_restore is unavailable for this non-SQL backup");

const tempDatabase = `${TEMP_PREFIX}${Date.now()}_${randomUUID().replaceAll("-", "").slice(0, 8)}`;
if (!new RegExp(`^${TEMP_PREFIX}[0-9]+_[a-f0-9]{8}$`).test(tempDatabase)) fail("generated temporary database name failed safety validation");
const pgEnv = { ...process.env, PGHOST: host, PGDATABASE: database, PGCONNECT_TIMEOUT: process.env.PGCONNECT_TIMEOUT ?? "10" };
let created = false;
let executionFailed = false;

function query(sql) { return run("psql", ["--dbname", tempDatabase, "--no-psqlrc", "--tuples-only", "--no-align", "--set", "ON_ERROR_STOP=1", "--command", sql], pgEnv, true); }

try {
  console.log(`Target verified as ${localHosts.has(host) ? "local" : "staging-only"}; creating isolated temporary database.`);
  run("createdb", [tempDatabase], pgEnv); created = true;
  if (sqlBackup) run("psql", ["--dbname", tempDatabase, "--no-psqlrc", "--set", "ON_ERROR_STOP=1", "--file", absoluteBackup], pgEnv);
  else run("pg_restore", ["--exit-on-error", "--no-owner", "--no-privileges", "--dbname", tempDatabase, absoluteBackup], pgEnv);

  const requiredTables = ["profiles", "communities", "channels", "messages", "community_members", "roles", "attachments"];
  for (const table of requiredTables) if (query(`select coalesce(to_regclass('public.${table}')::text,'');`) !== table) throw new Error(`restored table is missing: public.${table}`);

  console.log("Core row counts (staging verification only):");
  for (const table of requiredTables) console.log(`- ${table}: ${query(`select count(*) from public.${table};`)}`);

  const checks = [
    ["messages_without_valid_channel", "select count(*) from public.messages message left join public.channels channel on channel.id=message.channel_id where channel.id is null"],
    ["channels_without_valid_community", "select count(*) from public.channels channel left join public.communities community on community.id=channel.community_id where community.id is null"],
    ["members_without_valid_profile_or_community", "select count(*) from public.community_members member left join public.profiles profile on profile.id=member.user_id left join public.communities community on community.id=member.community_id where profile.id is null or community.id is null"],
    ["communities_without_valid_owner", "select count(*) from public.communities community left join public.profiles profile on profile.id=community.owner_id where profile.id is null"],
    ["attachments_without_valid_message", "select count(*) from public.attachments attachment left join public.messages message on message.id=attachment.message_id where attachment.message_id is not null and message.id is null"],
    ["roles_with_invalid_permissions_json", "select count(*) from public.roles where jsonb_typeof(permissions)<>'object'"],
    ["communities_without_member_role", "select count(*) from public.communities community where not exists(select 1 from public.roles role where role.community_id=community.id and lower(role.name)='member')"],
    ["duplicate_client_message_id", "select count(*) from (select author_id,client_message_id from public.messages where client_message_id is not null group by author_id,client_message_id having count(*)>1) duplicate"],
  ];
  let integrityFailures = 0;
  for (const [name, sql] of checks) { const count = Number(query(`${sql};`)); console.log(`- ${name}: ${count}`); if (!Number.isFinite(count) || count !== 0) integrityFailures += 1; }
  if (integrityFailures) throw new Error(`${integrityFailures} restored-data integrity checks failed`);

  const auditTable = query("select coalesce(to_regclass('public.audit_log')::text,'not_deployed');");
  console.log(`Audit table status: ${auditTable}. Verification performed no audit mutation.`);
  console.log("PASS: staging backup restored and passed read-only core integrity verification.");
} catch (error) {
  executionFailed = true;
  console.error(`FAIL: ${error instanceof Error ? error.message : String(error)}`);
} finally {
  if (created) {
    if (!tempDatabase.startsWith(TEMP_PREFIX)) throw new Error("Refusing cleanup of unexpected database name");
    const cleanup = spawnSync("dropdb", ["--if-exists", "--force", tempDatabase], { env: pgEnv, encoding: "utf8", stdio: "inherit", shell: false });
    if (cleanup.error || cleanup.status !== 0) console.error("CRITICAL: temporary verification database cleanup failed; contact the staging database owner.");
    else console.log("Temporary verification database removed.");
  }
}
if (executionFailed) process.exitCode = 1;
