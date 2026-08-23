import type { LiveScreenShareCategory } from "../../types/liveScreenShare";
import { AppIcon } from "../AppIcon";
import type { LiveCategoryBucket } from "./liveDiscoveryModel";

export type LiveCategoryRailProps = Readonly<{
  buckets: readonly LiveCategoryBucket[];
  activeCategory: LiveScreenShareCategory | null;
  onSelect: (category: LiveScreenShareCategory | null) => void;
}>;

export function LiveCategoryRail({ buckets, activeCategory, onSelect }: LiveCategoryRailProps) {
  if (buckets.length === 0) return null;

  return (
    <ul className="live-category-rail" aria-label="Live categories">
      {buckets.map((bucket) => {
        const active = activeCategory === bucket.id;
        const countLabel = bucket.liveCount === 1 ? "1 live now" : `${bucket.liveCount} live now`;
        return (
          <li key={bucket.id} className="live-category-rail__item">
            <button
              type="button"
              className={`live-category-card${active ? " is-active" : ""}`}
              aria-pressed={active}
              onClick={() => onSelect(active ? null : bucket.id)}
            >
              <span className="live-category-card__art" aria-hidden="true">
                <AppIcon name="live" size="lg" />
              </span>
              <span className="live-category-card__name">{bucket.label}</span>
              <span className="live-category-card__count">{countLabel}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
