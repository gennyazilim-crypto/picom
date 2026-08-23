import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const service = await import("../src/services/versionSemver.ts");
const { parseSemver, compareSemver, evaluateVersionCompatibility } = service;

function config(overrides = {}) {
  return {
    minimumSupportedVersion: "0.1.1-beta.10",
    recommendedClientVersion: "0.1.1-beta.10",
    latestVersion: "0.1.1-beta.10",
    releaseChannel: "beta",
    featureFlags: {},
    killSwitches: {},
    maintenance: { status: "operational", message: "ok" },
    uploadLimits: { maxUploadBytes: 1, allowedMimeTypes: [] },
    urls: { statusPageUrl: "", supportUrl: "", docsUrl: "" },
    source: "remote",
    fetchedAt: "2026-08-16T00:00:00.000Z",
    ...overrides,
  };
}

function evaluate(currentVersion, overrides = {}) {
  return evaluateVersionCompatibility(config(overrides), currentVersion);
}

assert.equal(compareSemver("0.1.1-beta.10", "0.1.1-beta.10"), 0, "CASE 01 exact minimum");
assert.equal(evaluate("0.1.1-beta.10").status, "supported", "CASE 01 exact minimum accepted");

assert.ok(compareSemver("0.1.1-beta.11", "0.1.1-beta.10") > 0, "CASE 02 newer prerelease");
assert.equal(evaluate("0.1.1-beta.11").status, "supported", "CASE 02 newer version accepted");
assert.ok(compareSemver("0.2.0-beta.1", "0.1.1-beta.10") > 0);
assert.ok(compareSemver("1.0.0", "0.1.1-beta.10") > 0);

assert.ok(compareSemver("0.1.1-beta.9", "0.1.1-beta.10") < 0, "CASE 03 older prerelease");
assert.equal(evaluate("0.1.1-beta.9").status, "update_required", "CASE 03 older version blocked");
assert.equal(evaluate("0.0.9").status, "update_required", "CASE 03 obsolete line blocked");

assert.ok(compareSemver("0.1.1-beta.1", "0.1.1-beta.10") < 0, "CASE 04 numeric prerelease");
assert.ok(compareSemver("0.1.1-beta.10", "0.1.1") < 0, "CASE 04 prerelease < release");
assert.ok(compareSemver("1.0.0-beta.1", "1.0.0") < 0, "CASE 04 1.0.0-beta.1 < 1.0.0");
assert.ok(compareSemver("0.1.1", "0.2.0-beta.1") < 0);
assert.equal(compareSemver("v0.1.1-beta.10", "0.1.1-beta.10"), 0, "CASE 04 leading v");
assert.equal(compareSemver(" 0.1.1-beta.10 ", "0.1.1-beta.10"), 0, "CASE 04 whitespace");

assert.equal(parseSemver("not-a-version"), null, "CASE 05 malformed client");
assert.equal(compareSemver("not-a-version", "0.1.1-beta.10"), null);
assert.equal(evaluate("not-a-version").status, "unknown", "CASE 05 malformed client fails safely");
assert.equal(evaluate("not-a-version").blocking, false);

assert.equal(parseSemver("1.0"), null, "CASE 06 malformed hosted min");
assert.equal(evaluate("0.1.1-beta.11", { minimumSupportedVersion: "latest" }).status, "unknown");
assert.equal(evaluate("0.1.1-beta.11", { minimumSupportedVersion: "latest" }).blocking, false);

const missingMin = evaluate("0.1.1-beta.11", { minimumSupportedVersion: "0.1.0" });
assert.equal(missingMin.status, "supported", "CASE 07 fallback floor 0.1.0 accepts current beta");

assert.equal(evaluate("0.1.1-beta.11", { minimumSupportedVersion: "1.0.0" }).status, "update_required", "CASE 08 stale 1.0.0 still force-blocks current beta");
assert.equal(evaluate("0.0.1", { minimumSupportedVersion: "0.1.1-beta.10" }).status, "update_required", "CASE 08 obsolete remains blocked");
assert.equal(
  evaluate("0.1.1-beta.9", { minimumSupportedVersion: "99.0.0", recommendedClientVersion: "not-semver" }).status,
  "update_required",
  "CASE 08 malformed recommended must not disable a valid force-update",
);

const channelBypass = evaluate("0.0.9", { releaseChannel: "beta", minimumSupportedVersion: "0.1.1-beta.10" });
assert.equal(channelBypass.status, "update_required", "CASE 09 channel metadata is not a bypass");
assert.equal(evaluate("0.1.1-beta.11", { releaseChannel: "stable" }).status, "supported", "CASE 09 single global minimum still accepts current beta");

const source = `${readFileSync("src/services/versionCompatibilityService.ts", "utf8")}\n${readFileSync("src/services/versionSemver.ts", "utf8")}`;
const notice = readFileSync("src/components/VersionCompatibilityNotice.tsx", "utf8");
const edge = readFileSync("supabase/functions/client-config/index.ts", "utf8");
assert.doesNotMatch(source, /FORCE_VERSION|bypassVersion|skipVersionGate|PICOM_IGNORE_VERSION/);
assert.doesNotMatch(notice, /FORCE_VERSION|bypassVersion|skipVersionGate/);
assert.match(notice, /source === "remote"/);
assert.match(notice, /status === "update_required"/);
assert.doesNotMatch(source, /process\.env/);
assert.match(edge, /0\.1\.1-beta\.10/);
assert.doesNotMatch(edge, /readPublicVersion\("PICOM_MINIMUM_SUPPORTED_VERSION", "1\.0\.0"\)/);
assert.equal(evaluate("0.1.1-beta.11").status, "supported", "CASE 16 current packaged client vs intended policy");
assert.equal(evaluate("0.1.1-beta.11", { minimumSupportedVersion: "1.0.0" }).status, "update_required", "CASE 16 obsolete 1.0.0 policy still blocks");

console.log("version-policy runtime: 10 cases passed");
