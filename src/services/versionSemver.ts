export type VersionCompatibilityStatus = "supported" | "update_recommended" | "update_required" | "unknown";
export type VersionCompatibilitySource = "defaults" | "cache" | "remote";

export type ParsedSemver = Readonly<{
  major: number;
  minor: number;
  patch: number;
  prerelease: readonly (string | number)[];
}>;

export type VersionCompatibilitySnapshot = Readonly<{
  currentVersion: string;
  minimumSupportedVersion: string;
  recommendedClientVersion: string;
  latestVersion: string;
  status: VersionCompatibilityStatus;
  blocking: boolean;
  message: string;
  source: VersionCompatibilitySource;
  checkedAt: string;
}>;

const SEMVER_CORE = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/;
const NUMERIC_IDENT = /^(0|[1-9]\d*)$/;
const PRERELEASE_IDENT = /^[0-9A-Za-z-]+$/;

function parsePrerelease(raw: string | undefined): readonly (string | number)[] | null {
  if (!raw) return [];
  const identifiers = raw.split(".");
  const parsed: Array<string | number> = [];
  for (const identifier of identifiers) {
    if (!identifier || !PRERELEASE_IDENT.test(identifier)) return null;
    parsed.push(NUMERIC_IDENT.test(identifier) ? Number(identifier) : identifier);
  }
  return parsed;
}

export function parseSemver(version: string): ParsedSemver | null {
  if (typeof version !== "string") return null;
  const match = version.trim().match(SEMVER_CORE);
  if (!match) return null;
  const prerelease = parsePrerelease(match[4]);
  if (!prerelease) return null;

  return Object.freeze({
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: Object.freeze(prerelease),
  });
}

function compareIdentifiers(left: string | number, right: string | number): number {
  const leftNumeric = typeof left === "number";
  const rightNumeric = typeof right === "number";
  if (leftNumeric && rightNumeric) return left === right ? 0 : left > right ? 1 : -1;
  if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
  if (left === right) return 0;
  return String(left) > String(right) ? 1 : -1;
}

export function compareSemver(leftVersion: string, rightVersion: string): number | null {
  const left = parseSemver(leftVersion);
  const right = parseSemver(rightVersion);
  if (!left || !right) return null;

  if (left.major !== right.major) return left.major > right.major ? 1 : -1;
  if (left.minor !== right.minor) return left.minor > right.minor ? 1 : -1;
  if (left.patch !== right.patch) return left.patch > right.patch ? 1 : -1;

  const leftPre = left.prerelease;
  const rightPre = right.prerelease;
  if (leftPre.length === 0 && rightPre.length === 0) return 0;
  if (leftPre.length === 0) return 1;
  if (rightPre.length === 0) return -1;

  const shared = Math.min(leftPre.length, rightPre.length);
  for (let index = 0; index < shared; index += 1) {
    const compared = compareIdentifiers(leftPre[index], rightPre[index]);
    if (compared !== 0) return compared;
  }
  if (leftPre.length === rightPre.length) return 0;
  return leftPre.length > rightPre.length ? 1 : -1;
}

function createMessage(status: VersionCompatibilityStatus): string {
  switch (status) {
    case "update_required":
      return "A newer version of PICOM is required.";
    case "update_recommended":
      return "A newer PICOM version is recommended.";
    case "unknown":
      return "Could not check version.";
    case "supported":
    default:
      return "This PICOM desktop version is supported.";
  }
}

export function evaluateVersionCompatibility(
  config: Readonly<{
    minimumSupportedVersion: string;
    recommendedClientVersion: string;
    latestVersion: string;
    source: VersionCompatibilitySource;
  }>,
  currentVersion: string,
): VersionCompatibilitySnapshot {
  const minimumCompare = compareSemver(currentVersion, config.minimumSupportedVersion);
  const recommendedCompare = compareSemver(currentVersion, config.recommendedClientVersion);

  let status: VersionCompatibilityStatus = "supported";
  if (minimumCompare === null) {
    status = "unknown";
  } else if (minimumCompare < 0) {
    status = "update_required";
  } else if (recommendedCompare !== null && recommendedCompare < 0) {
    status = "update_recommended";
  }

  return Object.freeze({
    currentVersion,
    minimumSupportedVersion: config.minimumSupportedVersion,
    recommendedClientVersion: config.recommendedClientVersion,
    latestVersion: config.latestVersion,
    status,
    blocking: status === "update_required",
    message: createMessage(status),
    source: config.source,
    checkedAt: new Date().toISOString(),
  });
}
