export type OfflineQueuedActionType = "sendMessage" | "editMessage" | "deleteMessage" | "addReaction" | "uploadAttachment";

export type OfflineSyncConflictCode =
  | "offline"
  | "backend_unreachable"
  | "channel_deleted"
  | "permission_lost"
  | "message_deleted"
  | "attachment_failed"
  | "duplicate_client_message"
  | "slow_mode"
  | "rate_limited"
  | "queue_full"
  | "unknown";

export type OfflineSyncResolutionAction = "retry" | "remove" | "copy_text" | "wait" | "reopen_channel" | "sign_in";

export type OfflineSyncConflict = Readonly<{
  code: OfflineSyncConflictCode;
  actionType: OfflineQueuedActionType;
  userMessage: string;
  retryable: boolean;
  resolutionActions: OfflineSyncResolutionAction[];
}>;

type ClassifyOfflineConflictInput = Readonly<{
  actionType: OfflineQueuedActionType;
  errorCode?: string | null;
  errorMessage?: string | null;
  browserOnline?: boolean;
}>;

const conflictMessageByCode: Record<OfflineSyncConflictCode, string> = {
  offline: "You are offline. Keep the message text and try again when Picom reconnects.",
  backend_unreachable: "Picom cannot reach the chat service right now. You can retry when the connection recovers.",
  channel_deleted: "This channel is no longer available. Remove the queued action or choose another channel.",
  permission_lost: "You no longer have permission to complete this action.",
  message_deleted: "That message was deleted before this action could sync.",
  attachment_failed: "The attachment could not be uploaded. Remove it or retry the upload.",
  duplicate_client_message: "This message already reached the server, so Picom will not send it again.",
  slow_mode: "Slow mode is active. Wait a moment before retrying.",
  rate_limited: "Picom is limiting this action for a moment. Wait and try again.",
  queue_full: "The offline queue is full. Copy this message and retry after Picom reconnects.",
  unknown: "Picom could not sync this action. You can retry or remove it.",
};

function normalizeText(value?: string | null): string {
  return (value ?? "").toLowerCase();
}

function getBrowserOnline(): boolean | undefined {
  if (typeof navigator === "undefined") return undefined;
  return navigator.onLine;
}

function inferConflictCode(input: ClassifyOfflineConflictInput): OfflineSyncConflictCode {
  const errorCode = normalizeText(input.errorCode);
  const errorMessage = normalizeText(input.errorMessage);
  const browserOnline = input.browserOnline ?? getBrowserOnline();

  if (browserOnline === false) return "offline";
  if (errorCode.includes("network") || errorMessage.includes("failed to fetch") || errorMessage.includes("network")) return "backend_unreachable";
  if (errorCode.includes("rate") || errorMessage.includes("rate limit")) return "rate_limited";
  if (errorCode.includes("queue_full") || errorMessage.includes("queue is full")) return "queue_full";
  if (errorCode.includes("slow") || errorMessage.includes("slow mode")) return "slow_mode";
  if (errorCode.includes("permission") || errorCode.includes("forbidden") || errorMessage.includes("permission") || errorMessage.includes("forbidden")) return "permission_lost";
  if (errorCode.includes("channel_not_found") || (errorMessage.includes("channel") && errorMessage.includes("not found"))) return "channel_deleted";
  if (errorCode.includes("message_not_found") || (errorMessage.includes("message") && errorMessage.includes("deleted"))) return "message_deleted";
  if (errorCode.includes("duplicate") || errorMessage.includes("duplicate") || errorMessage.includes("client_message")) return "duplicate_client_message";
  if (input.actionType === "uploadAttachment" || errorCode.includes("upload") || errorMessage.includes("upload")) return "attachment_failed";

  return "unknown";
}

function getResolutionActions(code: OfflineSyncConflictCode, actionType: OfflineQueuedActionType): OfflineSyncResolutionAction[] {
  if (code === "permission_lost") return ["remove", "reopen_channel"];
  if (code === "channel_deleted") return ["remove", "reopen_channel"];
  if (code === "message_deleted") return ["remove", "copy_text"];
  if (code === "duplicate_client_message") return ["remove"];
  if (code === "slow_mode" || code === "rate_limited") return ["wait", "retry", "copy_text"];
  if (code === "queue_full") return ["copy_text", "remove", "wait"];
  if (code === "attachment_failed") return ["retry", "remove"];
  if (actionType === "sendMessage" || actionType === "editMessage") return ["retry", "copy_text", "remove"];
  return ["retry", "remove"];
}

export const offlineSyncConflictService = {
  classify(input: ClassifyOfflineConflictInput): OfflineSyncConflict {
    const code = inferConflictCode(input);

    return {
      code,
      actionType: input.actionType,
      userMessage: conflictMessageByCode[code],
      retryable: ["offline", "backend_unreachable", "slow_mode", "rate_limited", "attachment_failed", "unknown"].includes(code),
      resolutionActions: getResolutionActions(code, input.actionType),
    };
  },
};
