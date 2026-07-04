import { AppIcon } from "./AppIcon";
import { MentionFeedTabs } from "./MentionFeedTabs";
import type { MentionFeedTab } from "../types/mentions";

type MentionFeedHeaderProps = {
  activeTab: MentionFeedTab;
  feedCount: number;
  followingCount: number;
  onTabChange: (tab: MentionFeedTab) => void;
};

export function MentionFeedHeader({ activeTab, feedCount, followingCount, onTabChange }: MentionFeedHeaderProps) {
  return (
    <header className="mention-feed-header">
      <div className="mention-feed-title">
        <p className="eyebrow">Mention tracking</p>
        <h1>Feeds</h1>
        <span>Popular people mentions and followed-person mentions across visible Picom communities.</span>
      </div>
      <button className="mention-refresh-button" type="button" aria-label="Refresh mention feed placeholder">
        <AppIcon name="search" size="sm" />
        <span>Refresh</span>
      </button>
      <MentionFeedTabs activeTab={activeTab} feedCount={feedCount} followingCount={followingCount} onTabChange={onTabChange} />
    </header>
  );
}
