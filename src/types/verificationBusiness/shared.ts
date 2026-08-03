export type Uuid = string;
export type IsoTimestamp = string;

export type PlatformServiceErrorCode =
  | "NOT_CONFIGURED"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION"
  | "UNSUPPORTED"
  | "UNAVAILABLE";

export type PlatformServiceError = Readonly<{
  code: PlatformServiceErrorCode;
  message: string;
}>;

export type PlatformServiceResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{ ok: false; error: PlatformServiceError }>;
