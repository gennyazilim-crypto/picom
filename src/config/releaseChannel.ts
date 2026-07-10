export const RELEASE_CHANNELS = ["dev", "beta", "stable"] as const;

export type ReleaseChannel = (typeof RELEASE_CHANNELS)[number];

export function isReleaseChannel(value: unknown): value is ReleaseChannel {
  return typeof value === "string" && RELEASE_CHANNELS.includes(value as ReleaseChannel);
}

export function resolveReleaseChannel(
  value: unknown,
  environment = "development",
): ReleaseChannel {
  if (isReleaseChannel(value)) {
    return value;
  }

  return environment === "beta" ? "beta" : "dev";
}

