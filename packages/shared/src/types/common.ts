export type ISODateString = string;
export type UUIDString = string;

export type UserStatus = "online" | "idle" | "dnd" | "offline";
export type ChannelType = "text" | "voice" | "forum";
export type AttachmentType = "image" | "file" | "sticker";

export type ApiErrorCode =
  | "AUTH_INVALID_CREDENTIALS"
  | "AUTH_SESSION_EXPIRED"
  | "AUTH_FORBIDDEN"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "COMMUNITY_NOT_FOUND"
  | "CHANNEL_NOT_FOUND"
  | "MESSAGE_NOT_FOUND"
  | "PERMISSION_DENIED"
  | "UPLOAD_TOO_LARGE"
  | "UPLOAD_INVALID_TYPE"
  | "REALTIME_UNAVAILABLE"
  | "INVITE_INVALID"
  | "INVITE_EXPIRED"
  | "SERVER_ERROR"
  | "NETWORK_ERROR";
