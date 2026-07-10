export const RELEASE_CHANNELS = ["dev", "beta", "stable"] as const;

export type ReleaseChannel = (typeof RELEASE_CHANNELS)[number];

export function isReleaseChannel(value: unknown): value is ReleaseChannel {
  return typeof value === "string" && RELEASE_CHANNELS.includes(value as ReleaseChannel);
}

export function deriveReleaseChannelFromVersion(version: string): Exclude<ReleaseChannel, "stable"> {
  const prerelease = version.split("-", 2)[1]?.split(".", 1)[0]?.toLowerCase();
  return prerelease === "beta" ? "beta" : "dev";
}

export function resolveReleaseChannel(
  value: unknown,
  environment = "development",
  version = "",
): ReleaseChannel {
  if (isReleaseChannel(value)) {
    return value;
  }

  if (environment === "beta" || deriveReleaseChannelFromVersion(version) === "beta") {
    return "beta";
  }

  // Stable is never inferred. Protected release CI must opt in explicitly.
  return "dev";
}
