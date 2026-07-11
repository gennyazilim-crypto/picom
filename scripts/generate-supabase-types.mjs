import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const args = process.argv.slice(2);
const has = (name) => args.includes(name);
const option = (name) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const projectId = option("--project-id");
const linked = has("--linked");
const local = has("--local") || (!linked && !projectId);
const checkOnly = has("--check");

if ([local, linked, Boolean(projectId)].filter(Boolean).length !== 1) throw new Error("Choose exactly one type source: --local, --linked, or --project-id <ref>.");
if (projectId && !/^[a-z0-9]{8,40}$/i.test(projectId)) throw new Error("Supabase project ref format is invalid.");

const target = resolve("src/services/supabase/database.types.ts");
const modeArgs = local ? ["--local"] : linked ? ["--linked"] : ["--project-id", projectId];
const result = spawnSync("supabase", ["gen", "types", "typescript", ...modeArgs, "--schema", "public"], {
  encoding: "utf8",
  maxBuffer: 32 * 1024 * 1024,
  shell: false,
});

if (result.error?.code === "ENOENT") throw new Error("Supabase CLI is unavailable. Install the reviewed CLI and start/link the intended non-production database before regenerating types.");
if (result.status !== 0) throw new Error("Supabase type generation failed. The committed type file was not changed.");

const generated = result.stdout.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trimEnd() + "\n";
for (const marker of ["export type Json", "export type Database", "Tables:", "Functions:"]) {
  if (!generated.includes(marker)) throw new Error(`Generated output is incomplete: missing ${marker}.`);
}
if (Buffer.byteLength(generated, "utf8") < 10_000) throw new Error("Generated output is unexpectedly small. The committed type file was not changed.");

if (checkOnly) {
  const current = existsSync(target) ? readFileSync(target, "utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n") : "";
  if (current !== generated) throw new Error("Committed database.types.ts is stale for the selected Supabase schema.");
  console.log("Supabase generated type snapshot is current.");
  process.exit(0);
}

const temporary = resolve(dirname(target), `.database.types.${process.pid}.tmp`);
try {
  writeFileSync(temporary, generated, { encoding: "utf8", flag: "wx" });
  renameSync(temporary, target);
} finally {
  rmSync(temporary, { force: true });
}
console.log("Supabase public-schema types generated atomically without BOM.");
