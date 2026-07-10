export type VoiceConnectionQuality = "excellent" | "good" | "poor" | "lost" | "unknown";
export type VoiceDurationBucket = "none" | "under_1m" | "1m_to_5m" | "5m_to_30m" | "30m_plus";

export function normalizeVoiceConnectionQuality(value: unknown): VoiceConnectionQuality {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized === "excellent" || normalized === "good" || normalized === "poor" || normalized === "lost") return normalized;
  return "unknown";
}

export function getVoiceDurationBucket(durationMs: number | null | undefined): VoiceDurationBucket {
  if (!durationMs || !Number.isFinite(durationMs) || durationMs <= 0) return "none";
  if (durationMs < 60_000) return "under_1m";
  if (durationMs < 5 * 60_000) return "1m_to_5m";
  if (durationMs < 30 * 60_000) return "5m_to_30m";
  return "30m_plus";
}
