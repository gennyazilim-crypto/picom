/**
 * Fail-closed guard: tracked Git blobs must stay under GitHub push limits.
 * Usage: node scripts/check-git-large-files.mjs
 */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const LIMIT_BYTES = 95 * 1024 * 1024;
const FORBIDDEN_PATH_RE = Object.freeze([
  /(^|\/)electron\.exe$/i,
  /(^|\/)Picom\.exe$/i,
  /(^|\/)node_modules\//i,
  /win-unpacked(\.tmp)?\//i,
  /(^|\/)release-task-[^/]+\/.*\.(exe|dll|msi)$/i,
  /(^|\/)release-update-[^/]+\/.*\.(exe|dll|msi)$/i,
  /(^|\/)release-brand-candidate\/.*\.(exe|dll|msi)$/i,
  /(^|\/)relbuild\//i,
]);
const ALLOWLIST = Object.freeze(new Set([]));

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function fail(detail) {
  console.error("PICOM_GIT_LARGE_FILES=FAIL");
  if (detail) console.error(detail);
  process.exit(1);
}

function isForbiddenPath(path) {
  return FORBIDDEN_PATH_RE.some((re) => re.test(path));
}

function main() {
  const listed = git(["ls-tree", "-r", "-l", "HEAD"]);
  const offenders = [];
  for (const line of listed.split(/\r?\n/).filter(Boolean)) {
    const tab = line.indexOf("\t");
    if (tab < 0) continue;
    const meta = line.slice(0, tab).trim().split(/\s+/);
    const path = line.slice(tab + 1).replace(/\\/g, "/");
    if (meta.length < 4 || meta[1] !== "blob") continue;
    if (ALLOWLIST.has(path)) continue;
    const size = Number(meta[3]);
    if (!Number.isFinite(size)) continue;
    if (size >= LIMIT_BYTES || isForbiddenPath(path)) {
      offenders.push({ path, size, sha: meta[2] });
    }
  }
  if (offenders.length) {
    fail(offenders.map((o) => `${o.path} sha=${o.sha.slice(0, 12)} size=${o.size}`).join("\n"));
  }
  console.log("PICOM_GIT_LARGE_FILES=PASS");
  console.log(`limit_bytes=${LIMIT_BYTES}`);
  console.log(`scanned_head_blobs=${listed.split(/\r?\n/).filter(Boolean).length}`);
}

main();
