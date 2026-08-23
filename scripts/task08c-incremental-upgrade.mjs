/**
 * TASK 08C dedicated incremental upgrade proofs on disposable Postgres DBs inside supabase_db_picom.
 * Paths: empty→latest, pre-foundation, production 221951→latest, advertising 230000→latest.
 */
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migDir = path.join(root, "supabase", "migrations");
const container = "supabase_db_picom";

function sh(cmd) {
  return execSync(cmd, { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
}

function psql(db, sql) {
  const b64 = Buffer.from(sql, "utf8").toString("base64");
  return sh(
    `docker exec -e PGPASSWORD=postgres ${container} bash -lc "echo ${b64} | base64 -d | psql -v ON_ERROR_STOP=1 -U postgres -d ${db} -f -"`,
  );
}

function listMigrations() {
  return fs
    .readdirSync(migDir)
    .filter((f) => /^\d{14}_.*\.sql$/.test(f))
    .sort();
}

function fingerprint(db) {
  const sql = `
    select json_build_object(
      'tables', (select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'),
      'columns', (select count(*) from information_schema.columns where table_schema='public'),
      'functions', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'),
      'policies', (select count(*) from pg_policies where schemaname='public'),
      'rls_disabled', (
        select coalesce(json_agg(c.relname order by c.relname), '[]'::json)
        from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public' and c.relkind='r' and not c.relrowsecurity
      ),
      'latest_migration', (select max(version) from supabase_migrations.schema_migrations),
      'migration_count', (select count(*) from supabase_migrations.schema_migrations),
      'has_metadata', exists(
        select 1 from information_schema.columns
        where table_schema='public' and table_name='community_live_screen_sessions' and column_name='metadata'
      ),
      'ads_public_exec', exists(
        select 1 from information_schema.routine_privileges
        where specific_schema='public' and routine_name='ads_allow_internal_transition'
          and grantee='PUBLIC' and privilege_type='EXECUTE'
      ),
      'role_catalog_rls', (
        select c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public' and c.relname='platform_role_catalog'
      )
    )::text;
  `;
  const out = psql(db, sql);
  const line = out
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.startsWith("{"));
  if (!line) throw new Error(`fingerprint parse failed for ${db}: ${out.slice(-300)}`);
  const json = JSON.parse(line);
  const sha = createHash("sha256").update(JSON.stringify(json)).digest("hex");
  return { json, sha };
}

function applyThrough(db, files) {
  // Ensure migrations history table exists (supabase style).
  psql(
    db,
    `
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key,
      statements text[],
      name text
    );
  `,
  );
  for (const file of files) {
    const version = file.slice(0, 14);
    const full = path.join(migDir, file).replace(/\\/g, "/");
    // Copy file into container via stdin
    const body = fs.readFileSync(path.join(migDir, file), "utf8");
    const wrapped = `${body}\n; insert into supabase_migrations.schema_migrations(version, name) values ('${version}', '${file.replace(/'/g, "''")}') on conflict do nothing;\n`;
    const b64 = Buffer.from(wrapped, "utf8").toString("base64");
    sh(
      `docker exec -e PGPASSWORD=postgres ${container} bash -lc "echo ${b64} | base64 -d | psql -v ON_ERROR_STOP=1 -U postgres -d ${db} -f -"`,
    );
  }
}

function recreateDb(name) {
  psql("postgres", `select pg_terminate_backend(pid) from pg_stat_activity where datname='${name}' and pid <> pg_backend_pid();`);
  psql("postgres", `drop database if exists ${name};`);
  psql("postgres", `create database ${name};`);
  // Extensions commonly required
  psql(
    name,
    `
    create extension if not exists "pgcrypto";
    create extension if not exists "uuid-ossp";
    create schema if not exists extensions;
    create extension if not exists "pgcrypto" with schema extensions;
  `,
  );
}

const all = listMigrations();
const latest = all.at(-1);
const paths = [
  { id: "A_empty", through: null, label: "empty→latest" },
  {
    id: "B_pre_foundation",
    through: "20260803130000",
    label: "pre-foundation→latest",
  },
  {
    id: "C_prod_221951",
    through: "20260803221951",
    label: "production 221951→latest",
  },
  {
    id: "D_pre_ads",
    through: "20260803230000",
    label: "advertising checkpoint→latest",
  },
];

const results = [];
const cleanFp = fingerprint("postgres"); // current main local DB as reference latest

for (const p of paths) {
  const db = `picom_inc_${p.id.toLowerCase()}`;
  const t0 = Date.now();
  try {
    recreateDb(db);
    const prefix = p.through ? all.filter((f) => f.slice(0, 14) <= p.through) : [];
    const suffix = p.through ? all.filter((f) => f.slice(0, 14) > p.through) : all;
    if (prefix.length) applyThrough(db, prefix);
    const sourceFp = fingerprint(db);
    applyThrough(db, suffix);
    const targetFp = fingerprint(db);
    const ok =
      targetFp.json.latest_migration === latest.slice(0, 14) &&
      targetFp.json.has_metadata === true &&
      targetFp.json.ads_public_exec === false &&
      targetFp.json.role_catalog_rls === true;
    results.push({
      path: p.label,
      db,
      exitCode: ok ? 0 : 1,
      durationMs: Date.now() - t0,
      sourceLatest: sourceFp.json.latest_migration,
      sourceSha: sourceFp.sha,
      appliedCount: suffix.length,
      targetLatest: targetFp.json.latest_migration,
      targetSha: targetFp.sha,
      cleanLatestSha: cleanFp.sha,
      ok,
      notes: ok ? "PASS" : "fingerprint/invariant mismatch",
    });
  } catch (err) {
    results.push({
      path: p.label,
      db,
      exitCode: 1,
      durationMs: Date.now() - t0,
      error: String(err?.message || err).slice(0, 500),
      ok: false,
    });
  }
}

fs.writeFileSync(
  path.join(root, "docs", "audit", "task08c-incremental-upgrade-results.json"),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), cleanFp, results }, null, 2)}\n`,
);
console.log(JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.ok);
process.exit(failed.length ? 1 : 0);
