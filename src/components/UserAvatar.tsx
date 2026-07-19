import { useEffect, useMemo, useState } from "react";
import { useProfileMedia } from "../hooks/useProfileMedia";
import "./UserAvatar.css";

type UserAvatarProps = {
  userId?: string | null;
  displayName: string;
  fallbackUrl?: string | null;
  size?: number;
  className?: string;
  alt?: string;
  priority?: "eager" | "lazy";
};

function initials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return ((parts[0]?.[0] ?? "P") + last).toUpperCase();
}

function pushUniqueUrl(list: string[], value?: string | null) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed || list.includes(trimmed)) return;
  list.push(trimmed);
}

export function UserAvatar({
  userId,
  displayName,
  fallbackUrl,
  size = 36,
  className = "",
  alt,
  priority = "lazy",
}: UserAvatarProps) {
  const media = useProfileMedia(userId);
  const candidates = useMemo(() => {
    const list: string[] = [];
    pushUniqueUrl(list, media.record?.avatar.thumbnailUrl);
    pushUniqueUrl(list, media.record?.avatar.url);
    pushUniqueUrl(list, media.record?.avatar.legacyUrl);
    pushUniqueUrl(list, fallbackUrl);
    return list;
  }, [fallbackUrl, media.record?.avatar.legacyUrl, media.record?.avatar.thumbnailUrl, media.record?.avatar.url]);
  const candidateKey = candidates.join("\0");
  const [failedSources, setFailedSources] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    setFailedSources(new Set());
  }, [userId, candidateKey]);
  const source = candidates.find((candidate) => !failedSources.has(candidate)) ?? null;
  const label = useMemo(() => initials(displayName), [displayName]);
  const showImage = Boolean(source);

  return (
    <span
      className={"user-avatar " + (media.state === "loading" && !source ? "is-loading " : "") + className}
      style={{ width: size, height: size }}
      aria-label={alt ?? displayName + " profile photo"}
      role="img"
    >
      {showImage ? (
        <img
          src={source ?? undefined}
          alt=""
          width={size}
          height={size}
          loading={priority}
          decoding="async"
          draggable={false}
          onError={() => {
            if (!source) return;
            setFailedSources((current) => {
              if (current.has(source)) return current;
              const next = new Set(current);
              next.add(source);
              return next;
            });
          }}
        />
      ) : <span className="user-avatar__initials" aria-hidden="true">{label}</span>}
    </span>
  );
}
