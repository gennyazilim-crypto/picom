/**
 * Fail closed for the Desktop Notifications release preflight.
 *
 * Pipe `supabase migration list --linked --output json` into this script after
 * restoring the exact recovered sources. It permits only the documented
 * legacy remote provenance exception; any other unexplained remote-only
 * migration remains a release blocker.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const notificationVersion = "20260904100000";
const exceptionPath = resolve(root, "docs/release/desktop-notifications-legacy-remote-provenance-exceptions.json");
const recoveredVersions = Object.freeze([
  "20260803210000", "20260803220000", "20260803225000", "20260803230000", "20260803240000",
  "20260803250000", "20260803270000", "20260804000000", "20260808220122", "20260809210000",
  "20260809220000", "20260809230000", "20260809231000", "20260809232000", "20260809233000",
  "20260809234000", "20260809235000", "20260816000000", "20260824120000", "20260824130000",
  "20260831110000", "20260831111000", "20260831112000",
]);

function block(code, detail) {
  console.error(`PICOM_DESKTOP_NOTIFICATION_HISTORY_PROVENANCE_GUARD=${code}`);
  if (detail) console.error(detail);
  process.exit(1);
}

function parseMigrationList(raw) {
  const start = raw.indexOf("{");
  if (start < 0) block("BLOCKED_UNPARSEABLE_MIGRATION_LIST", "Supabase CLI JSON was not present on stdin.");
  try {
    const parsed = JSON.parse(raw.slice(start));
    if (!Array.isArray(parsed.migrations)) block("BLOCKED_UNPARSEABLE_MIGRATION_LIST", "Missing migrations array.");
    return parsed.migrations;
  } catch {
    block("BLOCKED_UNPARSEABLE_MIGRATION_LIST", "Supabase CLI JSON could not be parsed.");
  }
}

const exceptionDocument = JSON.parse(readFileSync(exceptionPath, "utf8"));
const allowedRemoteOnly = new Set(
  exceptionDocument.exceptions
    .filter((item) => item.classification === "LEGACY_REMOTE_PROVENANCE_GAP" && item.exactSql === "UNAVAILABLE")
    .map((item) => item.version),
);

if (allowedRemoteOnly.size !== 1 || !allowedRemoteOnly.has("20260808220000")) {
  block("BLOCKED_EXCEPTION_DOCUMENT_DRIFT", "Only the reviewed 20260808220000 provenance gap may be allowlisted.");
}

const rows = parseMigrationList(readFileSync(0, "utf8"));
const remoteOnly = rows.filter((row) => !row.local && row.remote).map((row) => row.remote).sort();
const localOnly = rows.filter((row) => row.local && !row.remote).map((row) => row.local).sort();
const unexpectedRemoteOnly = remoteOnly.filter((version) => !allowedRemoteOnly.has(version));

if (unexpectedRemoteOnly.length) {
  block("BLOCKED_UNEXPLAINED_REMOTE_ONLY", unexpectedRemoteOnly.join(", "));
}
if (remoteOnly.length !== allowedRemoteOnly.size) {
  block("BLOCKED_LEGACY_EXCEPTION_MISSING_OR_EXTRA", remoteOnly.join(", "));
}
if (localOnly.length !== 1 || localOnly[0] !== notificationVersion) {
  block("BLOCKED_PENDING_MIGRATION_SET", localOnly.join(", "));
}

for (const version of recoveredVersions) {
  if (!rows.some((row) => row.local === version && row.remote === version)) {
    block("BLOCKED_RECOVERED_SOURCE_NOT_ALIGNED", version);
  }
}

console.log("PICOM_DESKTOP_NOTIFICATION_HISTORY_PROVENANCE_GUARD=PASS");
console.log(`legacyRemoteOnly=${remoteOnly.join(",")}`);
console.log(`classifiedPendingCandidate=${notificationVersion}`);
