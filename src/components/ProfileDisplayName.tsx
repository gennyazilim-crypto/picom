import { useProfileMedia } from "../hooks/useProfileMedia";

export function useProfileDisplayName(userId: string | null | undefined, fallback: string): string {
  const media = useProfileMedia(userId);
  const canonicalName = media.record?.displayName?.trim();
  return canonicalName || fallback;
}

export function ProfileDisplayName({ userId, fallback }: Readonly<{ userId?: string | null; fallback: string }>) {
  return <>{useProfileDisplayName(userId, fallback)}</>;
}

export function useProfileUsername(userId: string | null | undefined, fallback: string): string {
  const media = useProfileMedia(userId);
  const canonicalUsername = media.record?.username?.trim();
  return canonicalUsername || fallback;
}

export function ProfileUsername({ userId, fallback }: Readonly<{ userId?: string | null; fallback: string }>) {
  return <>{useProfileUsername(userId, fallback)}</>;
}
