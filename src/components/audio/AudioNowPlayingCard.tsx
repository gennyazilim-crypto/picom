import type { AudioPlayableItem } from "../../types/audio";
import { AppIcon } from "../AppIcon";

export function AudioNowPlayingCard({ item, compact = false }: { item: AudioPlayableItem; compact?: boolean }) {
  return <div className={`audio-now-playing ${compact ? "compact" : ""}`}>{item.coverUrl ? <img src={item.coverUrl} alt="" aria-hidden="true" /> : <span><AppIcon name="headphones" size={compact ? "sm" : "xl"} /></span>}<div><strong>{item.title}</strong><small>{item.contextLabel}</small></div></div>;
}
