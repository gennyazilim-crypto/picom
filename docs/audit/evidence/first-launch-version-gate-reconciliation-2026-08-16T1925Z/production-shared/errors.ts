export type EdgeErrorCode =
  | "AUTH_REQUIRED"
  | "AUTH_INVALID"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "METHOD_NOT_ALLOWED"
  | "SUPABASE_NOT_CONFIGURED"
  | "UPLOAD_INVALID_TYPE"
  | "UPLOAD_TOO_LARGE"
  | "VOICE_NOT_CONFIGURED"
  | "VOICE_CHANNEL_FORBIDDEN"
  | "VOICE_CHANNEL_REQUIRED"
  | "MEETING_ACCESS_DENIED"
  | "MEETING_WAITING"
  | "MEETING_NOT_CONFIGURED"
  | "INVITE_ACCEPTANCE_NOT_IMPLEMENTED"
  | "MODERATION_HELPER_NOT_IMPLEMENTED"
  | "NOTIFICATION_FANOUT_NOT_IMPLEMENTED"
  | "WEBHOOK_INVALID"
  | "WEBHOOK_RATE_LIMITED"
  | "WEBHOOK_DELIVERY_DISABLED"
  | "INTERNAL_ERROR";

export type EdgeErrorBody = {
  code: EdgeErrorCode;
  message: string;
  details?: unknown;
};

export function createEdgeErrorBody(code: EdgeErrorCode, message: string, details?: unknown): EdgeErrorBody {
  return details === undefined ? { code, message } : { code, message, details };
}
