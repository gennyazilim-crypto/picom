import { useEffect, useState } from "react";
import { useProfileMedia } from "../hooks/useProfileMedia";
import "./ProfileCover.css";

type ProfileCoverProps = {
  userId?: string | null;
  fallbackUrl?: string | null;
  label: string;
  className?: string;
};

export function ProfileCover({ userId, fallbackUrl, label, className = "" }: ProfileCoverProps) {
  const media = useProfileMedia(userId);
  const source = media.record?.cover.url ?? fallbackUrl ?? null;
  const [failedSource, setFailedSource] = useState<string | null>(null);
  useEffect(() => setFailedSource(null), [source]);
  return (
    <div className={"profile-cover " + (media.state === "loading" && !source ? "is-loading " : "") + className} aria-label={label} role="img">
      {source && source !== failedSource
        ? <img src={source} alt="" decoding="async" onError={() => setFailedSource(source)} />
        : null}
      <span className="profile-cover__overlay" aria-hidden="true" />
    </div>
  );
}
