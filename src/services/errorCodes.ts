export const appErrorCodes = [
  "AUTH_INVALID_CREDENTIALS",
  "AUTH_SESSION_EXPIRED",
  "AUTH_FORBIDDEN",
  "AUTH_NOT_CONFIGURED",
  "VALIDATION_ERROR",
  "RATE_LIMITED",
  "PERMISSION_DENIED",
  "COMMUNITY_NOT_FOUND",
  "CHANNEL_NOT_FOUND",
  "MESSAGE_NOT_FOUND",
  "INVITE_INVALID",
  "INVITE_EXPIRED",
  "NETWORK_ERROR",
  "SUPABASE_UNAVAILABLE",
  "REALTIME_UNAVAILABLE",
  "UPLOAD_TOO_LARGE",
  "UPLOAD_INVALID_TYPE",
  "VOICE_NOT_CONFIGURED",
  "VOICE_TOKEN_FAILED",
  "WINDOW_NATIVE_UNAVAILABLE",
  "SERVER_ERROR",
  "UNKNOWN_ERROR"
] as const;

export type AppErrorCode = (typeof appErrorCodes)[number];

export type AppErrorLike = Readonly<{
  code?: string;
  message?: string;
  status?: number;
}>;

const userMessages: Record<AppErrorCode, string> = {
  AUTH_INVALID_CREDENTIALS: "Email or password is incorrect.",
  AUTH_SESSION_EXPIRED: "Your session expired. Please sign in again.",
  AUTH_FORBIDDEN: "You do not have permission to do that.",
  AUTH_NOT_CONFIGURED: "Authentication is not configured for this build.",
  VALIDATION_ERROR: "Please check the highlighted fields and try again.",
  RATE_LIMITED: "Too many attempts. Please wait a moment and try again.",
  PERMISSION_DENIED: "You do not have permission to do that.",
  COMMUNITY_NOT_FOUND: "That community could not be found.",
  CHANNEL_NOT_FOUND: "That channel could not be found.",
  MESSAGE_NOT_FOUND: "That message could not be found.",
  INVITE_INVALID: "That invite link is invalid.",
  INVITE_EXPIRED: "That invite link has expired.",
  NETWORK_ERROR: "Network connection failed. Check your connection and try again.",
  SUPABASE_UNAVAILABLE: "The Picom backend is unavailable right now.",
  REALTIME_UNAVAILABLE: "Realtime connection is temporarily unavailable.",
  UPLOAD_TOO_LARGE: "The selected file is too large.",
  UPLOAD_INVALID_TYPE: "This file type is not supported.",
  VOICE_NOT_CONFIGURED: "Voice is not configured for this build.",
  VOICE_TOKEN_FAILED: "Could not join voice right now.",
  WINDOW_NATIVE_UNAVAILABLE: "This desktop action is unavailable in the current runtime.",
  SERVER_ERROR: "Picom ran into a server problem. Please try again.",
  UNKNOWN_ERROR: "Something went wrong. Please try again."
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function normalizeAppErrorCode(error: unknown): AppErrorCode {
  const rawCode = isRecord(error) && typeof error.code === "string" ? error.code : undefined;

  if (rawCode && (appErrorCodes as readonly string[]).includes(rawCode)) {
    return rawCode as AppErrorCode;
  }

  if (rawCode?.startsWith("AUTH_")) return rawCode === "AUTH_INVALID_CREDENTIALS" ? "AUTH_INVALID_CREDENTIALS" : "AUTH_FORBIDDEN";
  if (rawCode?.includes("PERMISSION") || rawCode?.includes("FORBIDDEN")) return "PERMISSION_DENIED";
  if (rawCode?.includes("COMMUNITY")) return "COMMUNITY_NOT_FOUND";
  if (rawCode?.includes("CHANNEL")) return "CHANNEL_NOT_FOUND";
  if (rawCode?.includes("MESSAGE")) return "MESSAGE_NOT_FOUND";
  if (rawCode?.includes("INVITE") && rawCode.includes("EXPIRED")) return "INVITE_EXPIRED";
  if (rawCode?.includes("INVITE")) return "INVITE_INVALID";
  if (rawCode?.includes("REALTIME")) return "REALTIME_UNAVAILABLE";
  if (rawCode?.includes("UPLOAD")) return rawCode.includes("TYPE") ? "UPLOAD_INVALID_TYPE" : "UPLOAD_TOO_LARGE";
  if (rawCode?.includes("VOICE_TOKEN")) return "VOICE_TOKEN_FAILED";
  if (rawCode?.includes("VOICE")) return "VOICE_NOT_CONFIGURED";
  if (rawCode?.includes("NETWORK") || rawCode?.includes("FETCH")) return "NETWORK_ERROR";

  if (isRecord(error) && typeof error.status === "number") {
    if (error.status === 401) return "AUTH_SESSION_EXPIRED";
    if (error.status === 403) return "PERMISSION_DENIED";
    if (error.status === 404) return "MESSAGE_NOT_FOUND";
    if (error.status === 429) return "RATE_LIMITED";
    if (error.status >= 500) return "SERVER_ERROR";
  }

  return "UNKNOWN_ERROR";
}

export function formatUserFacingError(error: unknown, fallbackMessage?: string): string {
  const code = normalizeAppErrorCode(error);
  return fallbackMessage ?? userMessages[code];
}

export function createSafeAppError(error: unknown, fallbackCode: AppErrorCode = "UNKNOWN_ERROR"): AppErrorLike {
  const code = normalizeAppErrorCode(error);
  const safeCode = code === "UNKNOWN_ERROR" ? fallbackCode : code;

  return {
    code: safeCode,
    message: userMessages[safeCode]
  };
}
