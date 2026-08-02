import type { KeyboardEvent } from "react";
import type { LiveScreenShareSummary } from "../../types/liveScreenShare";
import { AppIcon } from "../AppIcon";
import { broadcasterLabel } from "./LiveShareCard";

export type LiveFeaturedSelectorProps = Readonly<{
  items: readonly LiveScreenShareSummary[];
  selectedId: string | null;
  onSelect: (share: LiveScreenShareSummary) => void;
}>;

export function LiveFeaturedSelector({ items, selectedId, onSelect }: LiveFeaturedSelectorProps) {
  if (items.length === 0) return null;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = Math.max(0, items.findIndex((item) => item.id === selectedId));
    if (event.key === "ArrowRight") {
      event.preventDefault();
      const next = items[(currentIndex + 1) % items.length];
      if (next) onSelect(next);
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      const next = items[(currentIndex - 1 + items.length) % items.length];
      if (next) onSelect(next);
    }
  };

  return (
    <div
      className="live-featured-selector"
      role="listbox"
      aria-label="Featured stream selector"
      aria-orientation="horizontal"
      onKeyDown={onKeyDown}
    >
      {items.map((share) => {
        const selected = share.id === selectedId;
        const label = broadcasterLabel(share);
        return (
          <button
            key={share.id}
            type="button"
            role="option"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className={`live-featured-selector__item${selected ? " is-selected" : ""}`}
            onClick={() => onSelect(share)}
            title={share.title || label}
          >
            <span className="live-featured-selector__thumb" aria-hidden="true">
              <AppIcon name="live" size="sm" />
            </span>
            <span className="live-featured-selector__label">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
