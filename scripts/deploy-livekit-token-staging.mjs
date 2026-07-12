import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const apply = process.argv.includes("--apply");
const approvedProjectRef = "ufmtvqtsklqsmqxefbbs";
const migrationVersion = "20260712166000";
const migrationPath = `supabase/migrations/${migrationVersion}_active_member_voice_screen_access.sql`;
const prerequisiteMigrationVersions = ["20260711150600"];
const targetMigrationVersions = new Set([migrationVersion]);
const evidencePath = "artifacts/evidence/task-661-livekit-token-staging.json";
const requiredSecretNames = ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "PICOM_ALLOWED_ORIGINS", "PICOM_V1_VOICE_SCREEN_ENABLED"];
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
let appliedMigrationCount = 0;
let reconciledStoragePolicyCount = 0;
const deferredOwnerMigrations = [];
const outOfScopePendingMigrations = [];

const redact = (value) => String(value ?? "")
  .replace(/sbp_[A-Za-z0-9_-]+/g, "[REDACTED_SUPABASE_PAT]")
  .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, "[REDACTED_SUPABASE_KEY]")
  .replace(/eyJ[A-Za-z0-9._-]+/g, "[REDACTED_JWT]")
  .slice(0, 1200);

function writeEvidence(patch) {
  mkdirSync("artifacts/evidence", { recursive: true });
  let current = {};
  try { current = JSON.parse(readFileSync(evidencePath, "utf8")); } catch {}
  writeFileSync(evidencePath, `${JSON.stringify({ ...current, ...patch }, null, 2)}\n`, "utf8");
}

async function management(path, options = {}) {
  const response = await fetch(`https://api.supabase.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase Management API ${path} failed (${response.status}): ${redact(text)}`);
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

const runSupabase = (args) => spawnSync(npx, ["-y", "supabase@2.109.1", ...args], {
  encoding: "utf8",
  shell: process.platform === "win32",
  env: process.env,
});

function makePolicyCreatesIdempotent(sql) {
  return sql.replace(
    /(^|\n)([ \t]*)create\s+policy\s+("(?:[^"]|"")+")\s+on\s+((?:public|storage)\.[a-zA-Z_][a-zA-Z0-9_]*)/gi,
    (_match, lineStart, indent, policyName, tableName) => `${lineStart}${indent}drop policy if exists ${policyName} on ${tableName};\n${indent}create policy ${policyName} on ${tableName}`,
  );
}

const storagePolicyNamePattern = '("(?:[^"]|"")+"|[a-zA-Z_][a-zA-Z0-9_]*)';
const unquotePolicyName = (name) => name.startsWith('"') ? name.slice(1, -1).replaceAll('""', '"') : name;

function getStoragePolicyPlan(sql) {
  const creates = [...sql.matchAll(new RegExp(`create\\s+policy\\s+${storagePolicyNamePattern}\\s+on\\s+storage\\.objects`, "gi"))].map((match) => unquotePolicyName(match[1]));
  const drops = [...sql.matchAll(new RegExp(`drop\\s+policy\\s+(?:if\\s+exists\\s+)?${storagePolicyNamePattern}\\s+on\\s+storage\\.objects`, "gi"))].map((match) => unquotePolicyName(match[1]));
  return {
    creates: [...new Set(creates)],
    dropOnly: [...new Set(drops.filter((name) => !creates.includes(name)))],
    altersRls: /alter\s+table\s+storage\.objects\s+enable\s+row\s+level\s+security\s*;/i.test(sql),
  };
}

function omitVerifiedStorageOwnedDdl(sql) {
  const result = sql
    .replace(new RegExp(`drop\\s+policy\\s+(?:if\\s+exists\\s+)?${storagePolicyNamePattern}\\s+on\\s+storage\\.objects\\s*;`, "gi"), "")
    .replace(new RegExp(`create\\s+policy\\s+${storagePolicyNamePattern}\\s+on\\s+storage\\.objects[\\s\\S]*?;`, "gi"), "")
    .replace(new RegExp(`comment\\s+on\\s+policy\\s+${storagePolicyNamePattern}\\s+on\\s+storage\\.objects\\s+is\\s+'(?:''|[^'])*'\\s*;`, "gi"), "")
    .replace(/alter\s+table\s+storage\.objects\s+enable\s+row\s+level\s+security\s*;/gi, "");
  if (/(?:create|drop)\s+policy[\s\S]*?on\s+storage\.objects|comment\s+on\s+policy[\s\S]*?on\s+storage\.objects|alter\s+table\s+storage\.objects/i.test(result)) {
    throw new Error("Unsupported storage-owned DDL remains after reconciliation.");
  }
  return result;
}

const storagePlanProbe = getStoragePolicyPlan(makePolicyCreatesIdempotent('create policy "task661_probe" on storage.objects for select using (true);'));
if (!storagePlanProbe.creates.includes("task661_probe") || storagePlanProbe.dropOnly.length || omitVerifiedStorageOwnedDdl(makePolicyCreatesIdempotent('create policy "task661_probe" on storage.objects for select using (true);')).includes("storage.objects")) throw new Error("Storage policy reconciliation self-test failed.");

if (!apply) {
  const cli = runSupabase(["--version"]);
  console.log(JSON.stringify({
    status: cli.status === 0 ? "READY_FOR_EXPLICIT_STAGING_APPLY" : "BLOCKED",
    mode: "dry_run",
    function: "livekit-token",
    migrationVersion,
    approvedProjectRef,
    requiredSecretNames,
    blocker: cli.status === 0 ? null : "Supabase CLI is unavailable",
  }, null, 2));
  process.exit(0);
}

writeEvidence({
  schemaVersion: 1,
  task: 661,
  status: "running",
  project: "picom-staging",
  projectRef: approvedProjectRef,
  migrationVersion,
  function: "livekit-token",
  githubRunId: process.env.PICOM_EVIDENCE_RUN_ID ?? null,
  containsSecrets: false,
  startedAt: new Date().toISOString(),
});

try {
  const projectRef = process.env.SUPABASE_PROJECT_REF?.trim();
  const expectedRef = process.env.PICOM_LIVEKIT_STAGING_PROJECT_REF?.trim();
  if (process.env.PICOM_CONFIRM_LIVEKIT_EDGE_DEPLOY !== "STAGING_ONLY") throw new Error("Apply requires PICOM_CONFIRM_LIVEKIT_EDGE_DEPLOY=STAGING_ONLY.");
  if (process.env.PICOM_CONFIRM_LIVEKIT_MIGRATIONS_APPLIED !== "YES") throw new Error("Apply requires PICOM_CONFIRM_LIVEKIT_MIGRATIONS_APPLIED=YES.");
  if (!process.env.SUPABASE_ACCESS_TOKEN?.trim()) throw new Error("SUPABASE_ACCESS_TOKEN is unavailable in the protected staging environment.");
  if (!projectRef || projectRef !== expectedRef || projectRef !== approvedProjectRef) throw new Error("The protected project reference does not match the approved Picom staging project.");

  const secrets = await management(`/projects/${projectRef}/secrets`);
  const names = new Set((Array.isArray(secrets) ? secrets : []).map((item) => item?.name).filter((name) => typeof name === "string"));
  for (const name of requiredSecretNames) if (!names.has(name)) throw new Error(`Required Supabase secret name is missing: ${name}`);

  await management(`/projects/${projectRef}/database/query`, {
    method: "POST",
    body: JSON.stringify({
      query: "create schema if not exists supabase_migrations; create table if not exists supabase_migrations.schema_migrations(version text primary key, statements text[], name text)",
      read_only: false,
    }),
  });
  const historyRows = await management(`/projects/${projectRef}/database/query`, {
    method: "POST",
    body: JSON.stringify({ query: "select version from supabase_migrations.schema_migrations order by version", read_only: true }),
  });
  const appliedVersions = new Set((Array.isArray(historyRows) ? historyRows : []).map((row) => String(row?.version ?? "")).filter(Boolean));
  const schemaProbe = await management(`/projects/${projectRef}/database/query`, {
    method: "POST",
    body: JSON.stringify({ query: "select to_regclass('public.profiles') is not null as profiles_exists", read_only: true }),
  });
  if (!appliedVersions.size && Array.isArray(schemaProbe) && schemaProbe[0]?.profiles_exists) {
    throw new Error("Hosted schema exists without migration history; automatic reconciliation is blocked to avoid replaying unknown DDL.");
  }

  const migrations = readdirSync("supabase/migrations")
    .filter((file) => /^\d+_[a-z0-9_]+\.sql$/i.test(file))
    .sort((left, right) => left.localeCompare(right, "en"))
    .map((file) => {
      const match = /^(\d+)_(.+)\.sql$/i.exec(file);
      return { file, version: match[1], name: match[2] };
    });
  for (const version of prerequisiteMigrationVersions) {
    if (!appliedVersions.has(version)) throw new Error(`Required Voice prerequisite migration is not applied: ${version}`);
  }
  const prerequisiteFunctions = await management(`/projects/${projectRef}/database/query`, {
    method: "POST",
    body: JSON.stringify({
      query: "select to_regprocedure('public.community_voice_rooms_enabled(uuid)') is not null as rooms_enabled_gate, to_regprocedure('public.can_read_public_channel(uuid)') is not null as public_channel_gate",
      read_only: true,
    }),
  });
  const prerequisiteRow = Array.isArray(prerequisiteFunctions) ? prerequisiteFunctions[0] : null;
  if (!prerequisiteRow?.rooms_enabled_gate || !prerequisiteRow?.public_channel_gate) throw new Error("Required Voice prerequisite functions are unavailable.");
  const allPending = migrations.filter((migration) => !appliedVersions.has(migration.version));
  const pending = allPending.filter((migration) => targetMigrationVersions.has(migration.version));
  outOfScopePendingMigrations.push(...allPending.filter((migration) => !targetMigrationVersions.has(migration.version)).map((migration) => migration.version));
  writeEvidence({
    migrationsAppliedBefore: appliedVersions.size,
    pendingMigrationCount: pending.length,
    outOfScopePendingCount: outOfScopePendingMigrations.length,
    outOfScopePendingMigrations,
  });

  for (let index = 0; index < pending.length; index += 1) {
    if (index > 0 && index % 70 === 0) await new Promise((resolve) => setTimeout(resolve, 61_000));
    const migration = pending[index];
    const source = readFileSync(`supabase/migrations/${migration.file}`, "utf8").replace(/^\uFEFF/, "");
    let migrationSql = makePolicyCreatesIdempotent(source.replace(/^\s*begin;\s*/i, "").replace(/\s*commit;\s*$/i, "").trim());
    const storagePlan = getStoragePolicyPlan(migrationSql);
    if (storagePlan.creates.length || storagePlan.dropOnly.length || storagePlan.altersRls) {
      const storageInventory = await management(`/projects/${projectRef}/database/query`, {
        method: "POST",
        body: JSON.stringify({
          query: "select coalesce((select jsonb_agg(policyname order by policyname) from pg_policies where schemaname='storage' and tablename='objects'),'[]'::jsonb) as policy_names,coalesce((select relrowsecurity from pg_class where oid='storage.objects'::regclass),false) as rls_enabled",
          read_only: true,
        }),
      });
      const inventoryRow = Array.isArray(storageInventory) ? storageInventory[0] : null;
      const remotePolicies = new Set(Array.isArray(inventoryRow?.policy_names) ? inventoryRow.policy_names : []);
      const missingCreates = storagePlan.creates.filter((name) => !remotePolicies.has(name));
      const unsafeDrops = storagePlan.dropOnly.filter((name) => remotePolicies.has(name));
      if (missingCreates.length) {
        deferredOwnerMigrations.push({ version: migration.version, reason: "missing_storage_owner_policies", policyNames: missingCreates });
        console.log(`Deferred hosted migration ${migration.version}; ${missingCreates.length} Storage policies require the owner-authorized database path.`);
        continue;
      }
      if (unsafeDrops.length) throw new Error(`Drop-only Storage policies still exist and cannot be safely reconciled: ${unsafeDrops.join(", ")}`);
      if (storagePlan.altersRls && inventoryRow?.rls_enabled !== true) throw new Error("storage.objects RLS is not enabled and cannot be safely reconciled.");
      migrationSql = omitVerifiedStorageOwnedDdl(migrationSql);
      reconciledStoragePolicyCount += storagePlan.creates.length;
      console.log(`Verified ${storagePlan.creates.length} existing Storage policies for hosted migration ${migration.version}.`);
    }
    if (!migrationSql || migrationSql.includes("$task661$")) throw new Error(`Migration ${migration.version} is empty or contains the reserved deployment delimiter.`);
    const trackedSql = `begin;\n${migrationSql}\ninsert into supabase_migrations.schema_migrations(version,statements,name) values ('${migration.version}',array[$task661$${migrationSql}$task661$],'${migration.name}') on conflict(version) do update set statements=excluded.statements,name=excluded.name;\ncommit;`;
    try {
      await management(`/projects/${projectRef}/database/query`, { method: "POST", body: JSON.stringify({ query: trackedSql, read_only: false }) });
      appliedMigrationCount += 1;
      console.log(`Applied hosted migration ${migration.version}.`);
    } catch (error) {
      throw new Error(`Hosted migration ${migration.version} failed: ${redact(error instanceof Error ? error.message : error)}`);
    }
  }

  const memberSource = readFileSync(migrationPath, "utf8");
  if (!memberSource.includes("is_active_community_media_member") || !memberSource.includes("authorize_livekit_room")) throw new Error("Reviewed active-member authorization migration contract is incomplete.");

  const verification = await management(`/projects/${projectRef}/database/query`, {
    method: "POST",
    body: JSON.stringify({
      query: "select to_regprocedure('public.is_active_community_media_member(uuid,uuid)') is not null as member_gate, to_regprocedure('public.authorize_livekit_room(uuid,uuid,text)') is not null as token_gate, exists(select 1 from supabase_migrations.schema_migrations where version='20260712166000') as migration_recorded",
      read_only: true,
    }),
  });
  const verificationRow = Array.isArray(verification) ? verification[0] : null;
  if (!verificationRow?.member_gate || !verificationRow?.token_gate || !verificationRow?.migration_recorded) throw new Error("Hosted migration verification failed.");

  const deploy = runSupabase(["functions", "deploy", "livekit-token", "--project-ref", projectRef]);
  if (deploy.status !== 0) throw new Error(`LiveKit token Function deployment failed: ${redact(deploy.stderr || deploy.stdout)}`);
  const inventory = runSupabase(["functions", "list", "--project-ref", projectRef]);
  if (inventory.status !== 0 || !inventory.stdout.includes("livekit-token")) throw new Error(`Deployed Function inventory verification failed: ${redact(inventory.stderr || inventory.stdout)}`);

  writeEvidence({
    status: "deployed",
    migrationApplied: true,
    migrationRecorded: true,
    migrationsAppliedThisRun: appliedMigrationCount,
    reconciledExistingStoragePolicies: reconciledStoragePolicyCount,
    deferredOwnerMigrations,
    outOfScopePendingMigrations,
    requiredSecretNamesPresent: requiredSecretNames,
    functionDeployed: true,
    functionInventoryVerified: true,
    deployedAt: new Date().toISOString(),
  });
  console.log("DEPLOYED active-member authorization migration and livekit-token to the approved Picom staging project; no credential value was printed.");
} catch (error) {
  const safeMessage = redact(error instanceof Error ? error.message : error);
  writeEvidence({ status: "failed", failure: safeMessage, migrationsAppliedThisRun: appliedMigrationCount, reconciledExistingStoragePolicies: reconciledStoragePolicyCount, deferredOwnerMigrations, outOfScopePendingMigrations, finishedAt: new Date().toISOString() });
  throw new Error(safeMessage);
}
