import type { ApiErrorCode } from "./common";

export type ApiErrorDTO = Readonly<{
  code: ApiErrorCode;
  message: string;
  details?: Record<string, unknown>;
  requestId?: string;
}>;

export type ApiResult<TData> =
  | Readonly<{ ok: true; data: TData }>
  | Readonly<{ ok: false; error: ApiErrorDTO }>;
