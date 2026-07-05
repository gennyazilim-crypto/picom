export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key" as const;

export type IdempotencyOperation =
  | "send_message"
  | "create_community"
  | "create_channel"
  | "upload_attachment"
  | "accept_invite"
  | "create_invite"
  | "create_webhook";

export type IdempotencyRecordStatus = "pending" | "succeeded" | "failed" | "expired";

export type IdempotencyRequest = Readonly<{
  idempotencyKey?: string | null;
}>;

export type IdempotencyRecordDTO<TResponse = unknown> = Readonly<{
  id: string;
  keyHash: string;
  operation: IdempotencyOperation;
  status: IdempotencyRecordStatus;
  response?: TResponse;
  createdAt: string;
  expiresAt: string;
}>;

