export type EdgeErrorCode =
  | "AUTH_REQUIRED"
  | "AUTH_INVALID"
  | "VALIDATION_ERROR"
  | "METHOD_NOT_ALLOWED"
  | "SUPABASE_NOT_CONFIGURED"
  | "UPLOAD_INVALID_TYPE"
  | "UPLOAD_TOO_LARGE"
  | "VOICE_NOT_CONFIGURED"
  | "VOICE_CHANNEL_FORBIDDEN"
  | "VOICE_CHANNEL_REQUIRED"
  | "INVITE_ACCEPTANCE_NOT_IMPLEMENTED"
  | "MODERATION_HELPER_NOT_IMPLEMENTED"
  | "NOTIFICATION_FANOUT_NOT_IMPLEMENTED"
  | "INTERNAL_ERROR";

export type EdgeErrorBody = {
  code: EdgeErrorCode;
  message: string;
  details?: unknown;
};

export function createEdgeErrorBody(code: EdgeErrorCode, message: string, details?: unknown): EdgeErrorBody {
  return details === undefined ? { code, message } : { code, message, details };
}
