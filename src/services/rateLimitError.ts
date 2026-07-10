type RateLimitLikeError = Readonly<{ status?: unknown; code?: unknown; message?: unknown }>;

export function isRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as RateLimitLikeError;
  if (candidate.status === 429) return true;
  const code = typeof candidate.code === "string" ? candidate.code.toUpperCase() : "";
  const message = typeof candidate.message === "string" ? candidate.message.toUpperCase() : "";
  return code.includes("RATE_LIMIT") || message.includes("RATE_LIMITED") || message.includes("RATE LIMIT");
}

export const rateLimitUserMessage = "Too many requests. Please wait a moment and try again.";

