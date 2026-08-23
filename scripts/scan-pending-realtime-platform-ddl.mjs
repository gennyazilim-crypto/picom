/**
 * Scan pending production migrations for platform-owned realtime structural DDL.
 * Pending = versions > lastApplied (default 20260710090000).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(".");
const lastApplied = process.argv[2] || "20260710090000";
const dir = join(root, "supabase/migrations");
const files = readdirSync(dir)
  .filter((f) => /^\d{14}_.+\.sql$/.test(f))
  .sort();

const structural = [
  { name: "ALTER_TABLE_REALTIME", re: /alter\s+table\s+realtime\./i },
  { name: "CREATE_TABLE_REALTIME", re: /create\s+table\s+(?:if\s+not\s+exists\s+)?realtime\./i },
  { name: "DROP_TABLE_REALTIME", re: /drop\s+table\s+(?:if\s+exists\s+)?realtime\./i },
  { name: "ALTER_OWNER_REALTIME", re: /alter\s+(?:table|schema)\s+realtime\b[\s\S]{0,80}owner\s+to\b/i },
  { name: "ALTER_SCHEMA_REALTIME", re: /alter\s+schema\s+realtime\b/i },
  {
    name: "DISABLE_RLS_REALTIME",
    re: /alter\s+table\s+realtime\.[a-z0-9_"]+\s+disable\s+row\s+level\s+security/i,
  },
  {
    name: "FORCE_RLS_REALTIME",
    re: /alter\s+table\s+realtime\.[a-z0-9_"]+\s+force\s+row\s+level\s+security/i,
  },
];

const grantRevoke = [
  { name: "GRANT_REALTIME_MESSAGES", re: /grant\s+.+?\s+on\s+(?:table\s+)?realtime\.messages\b/i },
  { name: "REVOKE_REALTIME_MESSAGES", re: /revoke\s+.+?\s+on\s+(?:table\s+)?realtime\.messages\b/i },
];

const informational = [
  {
    name: "FORCE_RLS_NON_REALTIME",
    re: /alter\s+table\s+(?!realtime\.)[a-z0-9_."]+\s+force\s+row\s+level\s+security/i,
  },
];

const safePolicy = [
  { name: "CREATE_POLICY_REALTIME_MESSAGES", re: /create\s+policy[\s\S]{0,200}on\s+realtime\.messages/i },
  { name: "DROP_POLICY_REALTIME_MESSAGES", re: /drop\s+policy[\s\S]{0,120}on\s+realtime\.messages/i },
];

let blockers = 0;
let safes = 0;
console.log(`LAST_APPLIED=${lastApplied}`);
for (const file of files) {
  const version = file.slice(0, 14);
  if (version <= lastApplied) continue;
  const text = readFileSync(join(dir, file), "utf8");
  const hits = [];
  for (const rule of structural) {
    if (rule.re.test(text)) hits.push(`BLOCKER:${rule.name}`);
  }
  for (const rule of grantRevoke) {
    if (rule.re.test(text)) hits.push(`REVIEW:${rule.name}`);
  }
  for (const rule of safePolicy) {
    if (rule.re.test(text)) hits.push(`SAFE:${rule.name}`);
  }
  for (const rule of informational) {
    if (rule.re.test(text)) hits.push(`INFO:${rule.name}`);
  }
  // Special-case: 20260710121000 now uses assertion, not ALTER — re-check
  if (version === "20260710121000") {
    const hasAlterEnable = /alter\s+table\s+realtime\.messages\s+enable\s+row\s+level\s+security/i.test(text);
    const hasGuard = /picom_realtime_guard/i.test(text);
    if (hasAlterEnable) hits.push("BLOCKER:ALTER_ENABLE_RLS");
    if (hasGuard) hits.push("SAFE:RLS_ASSERTION_GUARD");
  }
  if (!hits.length) continue;
  const isBlocker = hits.some((h) => h.startsWith("BLOCKER:"));
  if (isBlocker) blockers += 1;
  if (hits.some((h) => h.startsWith("SAFE:"))) safes += 1;
  console.log(`${version} ${file}`);
  for (const h of hits) console.log(`  ${h}`);
}
console.log(`BLOCKER_COUNT=${blockers}`);
console.log(`SAFE_POLICY_TOUCH_COUNT=${safes}`);
console.log(blockers === 0 ? "PLATFORM_DDL_SCAN=PASS" : "PLATFORM_DDL_SCAN=BLOCKED");
process.exit(blockers === 0 ? 0 : 2);
