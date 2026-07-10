import type { MentionFeedTab } from "../types/mentions";

type MentionFeedTabsProps = {
  activeTab: MentionFeedTab;
  feedCount: number;
  followingCount: number;
  onTabChange: (tab: MentionFeedTab) => void;
};

export function MentionFeedTabs({ activeTab, feedCount, followingCount, onTabChange }: MentionFeedTabsProps) {
  return (
    <div className="mention-tabs" role="tablist" aria-label="Mention feed sections">
      <button
        className={activeTab === "feed" ? "active" : ""}
        type="button"
        role="tab"
        aria-selected={activeTab === "feed"}
        onClick={() => onTabChange("feed")}
      >
        <span className="mention-tab-label">Feed</span>
        <span className="mention-tab-count">{feedCount}</span>
      </button>
      <button
        className={activeTab === "following" ? "active" : ""}
        type="button"
        role="tab"
        aria-selected={activeTab === "following"}
        title="Takip Ettiğin Kişiler"
        onClick={() => onTabChange("following")}
      >
        <span className="mention-tab-label">Takip Ettiğin Kişiler</span>
        <span className="mention-tab-count">{followingCount}</span>
      </button>
    </div>
  );
}
