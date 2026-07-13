import { AppIcon } from "./AppIcon";
import type { MentionFeedTab } from "../types/mentions";

type MentionFeedTabsProps = {
  activeTab: MentionFeedTab;
  feedCount: number;
  followingCount: number;
  onTabChange: (tab: MentionFeedTab) => void;
};

export function MentionFeedTabs({ activeTab, feedCount, followingCount, onTabChange }: MentionFeedTabsProps) {
  return (
    <div className="mention-tabs mention-tabs--segmented" role="tablist" aria-label="Mention feed sections">
      <button
        className={activeTab === "feed" ? "active" : ""}
        type="button"
        role="tab"
        aria-selected={activeTab === "feed"}
        onClick={() => onTabChange("feed")}
      >
        <AppIcon name="home" size="xs" />
        <span className="mention-tab-label">Feed</span>
        <span className="mention-tab-count" aria-label={`${feedCount} gönderi`}>
          {feedCount}
        </span>
      </button>
      <button
        className={activeTab === "following" ? "active" : ""}
        type="button"
        role="tab"
        aria-selected={activeTab === "following"}
        title="Takip ettiğin kişiler"
        onClick={() => onTabChange("following")}
      >
        <AppIcon name="users" size="xs" />
        <span className="mention-tab-label">Takip</span>
        <span className="mention-tab-count" aria-label={`${followingCount} gönderi`}>
          {followingCount}
        </span>
      </button>
    </div>
  );
}
