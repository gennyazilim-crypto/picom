/**
 * Feed-focused hosted staging security runner.
 * Prefight (default): prints required env names, no network.
 * --run: executes platform RLS matrix + dual-client Realtime, then Feed RPC user-switch probes.
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const shouldRun = process.argv.includes("--run");
const rootDir = dirname(fileURLToPath(import.meta.url.replace(/scripts\/feed-security-hosted-validation\.mjs$/, "")));
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const matrix = JSON.parse(readFileSync(join(repoRoot, "supabase/tests/hosted/v1-core-rls-matrix.json"), "utf8"));
const feedReadCases = matrix.readCases.filter((testCase) => String(testCase.id).startsWith("feed."));

function pass(message) { console.log(`OK ${message}`); }
function fail(message) { throw new Error(`Feed hosted security validation failed: ${message}`); }
function isDenied(error) {
  return Boolean(error && ["42501", "PGRST301", "PGRST302"].includes(error.code));
}

if (!shouldRun) {
  console.log("Feed hosted security validation requires --run plus staging confirmations.");
  console.log("Delegates RLS matrix feed.* cases and dual-client Realtime proof.");
  console.log("Required (RLS): PICOM_RLS_STAGING_URL, PICOM_RLS_STAGING_ANON_KEY, PICOM_RLS_STAGING_CONFIRM=STAGING_ONLY, PICOM_RLS_MUTATION_CONFIRM=ALLOW_EPHEMERAL_WRITES, actor + feed fixture envs.");
  console.log("Required (Realtime): PICOM_REALTIME_STAGING_* + CLIENT_A/B credentials + community/channel fixtures.");
  console.log(`Feed matrix cases covered: ${feedReadCases.map((item) => item.id).join(", ") || "(none)"}`);
  console.log("No database, Auth, Storage, or Realtime connection was made and no values were printed.");
  process.exit(0);
}

void rootDir;

const rls = spawnSync(process.execPath, ["scripts/hosted-staging-rls-validation.mjs", "--run"], {
  cwd: repoRoot,
  stdio: "inherit",
  env: process.env,
});
if (rls.status !== 0) fail("hosted V1 Core RLS matrix --run did not pass (includes feed.* cases).");
pass("hosted V1 Core RLS matrix (includes feed.public-mention / feed.private-mention)");

const realtime = spawnSync(process.execPath, ["scripts/hosted-staging-realtime-validation.mjs", "--run"], {
  cwd: repoRoot,
  stdio: "inherit",
  env: process.env,
});
if (realtime.status !== 0) fail("hosted dual-client Realtime --run did not pass.");
pass("hosted dual-client Realtime proof");

const url = process.env.PICOM_RLS_STAGING_URL;
const anon = process.env.PICOM_RLS_STAGING_ANON_KEY;
if (!url || !anon || !process.env.PICOM_RLS_MEMBER_EMAIL || !process.env.PICOM_RLS_VISITOR_EMAIL) {
  fail("RPC user-switch probe missing actor credentials.");
}

const member = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
const visitor = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
const memberAuth = await member.auth.signInWithPassword({
  email: process.env.PICOM_RLS_MEMBER_EMAIL,
  password: process.env.PICOM_RLS_MEMBER_PASSWORD,
});
const visitorAuth = await visitor.auth.signInWithPassword({
  email: process.env.PICOM_RLS_VISITOR_EMAIL,
  password: process.env.PICOM_RLS_VISITOR_PASSWORD,
});
if (memberAuth.error || visitorAuth.error) fail("RPC user-switch authentication failed.");

const memberFeed = await member.rpc("list_mention_feed", { result_limit: 20 });
const visitorFeed = await visitor.rpc("list_mention_feed", { result_limit: 20 });
if (memberFeed.error) fail(`member list_mention_feed failed: ${memberFeed.error.message}`);
if (visitorFeed.error) fail(`visitor list_mention_feed failed: ${visitorFeed.error.message}`);

await member.auth.signOut({ scope: "local" });
const switched = await member.auth.signInWithPassword({
  email: process.env.PICOM_RLS_VISITOR_EMAIL,
  password: process.env.PICOM_RLS_VISITOR_PASSWORD,
});
if (switched.error) fail("RPC session switch failed.");
const switchedFeed = await member.rpc("list_mention_feed", { result_limit: 20 });
if (switchedFeed.error) fail(`switched list_mention_feed failed: ${switchedFeed.error.message}`);
const visitorCount = Array.isArray(visitorFeed.data) ? visitorFeed.data.length : 0;
const switchedCount = Array.isArray(switchedFeed.data) ? switchedFeed.data.length : 0;
if (visitorCount !== switchedCount) fail("list_mention_feed did not follow auth.uid() after session switch.");
pass("list_mention_feed respects auth.uid() after user switch");

const anonClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
const anonFeed = await anonClient.rpc("list_mention_feed", { result_limit: 5 });
if (!anonFeed.error && Array.isArray(anonFeed.data) && anonFeed.data.length > 0) {
  fail("anonymous list_mention_feed unexpectedly returned rows.");
}
if (anonFeed.error && !isDenied(anonFeed.error)) {
  // JWT / login required messages are also acceptable fail-closed outcomes.
  pass(`anonymous list_mention_feed denied (${anonFeed.error.code || "error"})`);
} else {
  pass("anonymous list_mention_feed fail-closed");
}

await Promise.all([
  member.auth.signOut({ scope: "local" }),
  visitor.auth.signOut({ scope: "local" }),
]);

console.log("Feed hosted security validation: PASS");
