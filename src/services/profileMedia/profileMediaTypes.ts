export const PROFILE_MEDIA_BUCKET = "profile-media" as const;

export type ProfileMediaKind = "avatar" | "cover";
export type ProfileMediaLoadState = "idle" | "loading" | "ready" | "error";
export type ProfileMediaCrop = Readonly<{
  zoom: number;
  rotation: number;
  offsetX: number;
  offsetY: number;
}>;

export type ProfileMediaAsset = Readonly<{
  path: string | null;
  thumbnailPath: string | null;
  version: number;
  contentHash: string | null;
  updatedAt: string | null;
  legacyUrl: string | null;
  url: string | null;
  thumbnailUrl: string | null;
}>;

export type ProfileMediaRecord = Readonly<{
  userId: string;
  canView: boolean;
  displayName: string | null;
  avatar: ProfileMediaAsset;
  cover: ProfileMediaAsset;
  updatedAt: string | null;
  signedUrlExpiresAt: number | null;
}>;

export type ProfileMediaSnapshot = Readonly<{
  state: ProfileMediaLoadState;
  record: ProfileMediaRecord | null;
  error: string | null;
}>;

export type ProfileMediaProgress = Readonly<{
  percent: number;
  stage: "validating" | "processing" | "uploading" | "saving" | "complete";
}>;

export type ProfileMediaErrorCode =
  | "AUTH_REQUIRED"
  | "CONFIG_REQUIRED"
  | "OFFLINE"
  | "VALIDATION_ERROR"
  | "UPLOAD_CANCELED"
  | "UPLOAD_FAILED"
  | "VERSION_CONFLICT"
  | "PROFILE_UPDATE_FAILED"
  | "REMOVE_FAILED";

export type ProfileMediaResult<T> =
  | Readonly<{ ok: true; data: T }>
  | Readonly<{ ok: false; error: { code: ProfileMediaErrorCode; message: string } }>;
