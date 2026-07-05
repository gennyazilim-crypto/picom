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
    <header className="mention-feed-tabs-header">
      <MentionFeedTabs activeTab={activeTab} feedCount={feedCount} followingCount={followingCount} onTabChange={onTabChange} />
    </header>
  );
}
