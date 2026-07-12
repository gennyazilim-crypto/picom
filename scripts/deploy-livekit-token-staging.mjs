import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const apply = process.argv.includes("--apply");
const approvedProjectRef = "ufmtvqtsklqsmqxefbbs";
const migrationVersion = "20260712166000";
const migrationPath = `supabase/migrations/${migrationVersion}_active_member_voice_screen_access.sql`;
const evidencePath = "artifacts/evidence/task-661-livekit-token-staging.json";
const requiredSecretNames = ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "PICOM_ALLOWED_ORIGINS", "PICOM_V1_VOICE_SCREEN_ENABLED"];
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

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

  const source = readFileSync(migrationPath, "utf8");
  const migrationSql = source.replace(/^\s*begin;\s*/i, "").replace(/\s*commit;\s*$/i, "").trim();
  if (!migrationSql.includes("is_active_community_media_member") || !migrationSql.includes("authorize_livekit_room")) throw new Error("Reviewed active-member authorization migration contract is incomplete.");
  if (migrationSql.includes("$task661$")) throw new Error("Migration contains the reserved evidence delimiter.");

  const trackedSql = `
begin;
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);
${migrationSql}
insert into supabase_migrations.schema_migrations(version,statements,name)
values ('${migrationVersion}',array[$task661$${migrationSql}$task661$],'active_member_voice_screen_access')
on conflict(version) do update set statements=excluded.statements,name=excluded.name;
commit;`;
  await management(`/projects/${projectRef}/database/query`, { method: "POST", body: JSON.stringify({ query: trackedSql, read_only: false }) });

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
    requiredSecretNamesPresent: requiredSecretNames,
    functionDeployed: true,
    functionInventoryVerified: true,
    deployedAt: new Date().toISOString(),
  });
  console.log("DEPLOYED active-member authorization migration and livekit-token to the approved Picom staging project; no credential value was printed.");
} catch (error) {
  const safeMessage = redact(error instanceof Error ? error.message : error);
  writeEvidence({ status: "failed", failure: safeMessage, finishedAt: new Date().toISOString() });
  throw new Error(safeMessage);
}
