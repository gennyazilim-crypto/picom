import { MentionFeedTabs } from "./MentionFeedTabs";
import { MentionFeedMessageAlerts } from "./MentionFeedMessageAlerts";
import type { DirectConversation } from "../types/directMessages";
import type { MentionFeedTab } from "../types/mentions";

type MentionFeedHeaderProps = {
  activeTab: MentionFeedTab;
  feedCount: number;
  followingCount: number;
  directConversations: readonly DirectConversation[];
  currentUserId: string;
  onTabChange: (tab: MentionFeedTab) => void;
  onOpenDirectConversation: (conversation: DirectConversation) => void;
};

export function MentionFeedHeader({
  activeTab,
  feedCount,
  followingCount,
  directConversations,
  currentUserId,
  onTabChange,
  onOpenDirectConversation,
}: MentionFeedHeaderProps) {
  const activeCount = activeTab === "feed" ? feedCount : followingCount;

  return (
    <header className="mention-feed-tabs-header">
      <div className="mention-feed-toolbar">
        <MentionFeedTabs
          activeTab={activeTab}
          feedCount={feedCount}
          followingCount={followingCount}
          onTabChange={onTabChange}
        />
        <MentionFeedMessageAlerts
          conversations={directConversations}
          currentUserId={currentUserId}
          onOpenConversation={onOpenDirectConversation}
        />
        <div className="mention-feed-toolbar-meta">
          <span className="mention-feed-toolbar-count">{activeCount} gönderi</span>
        </div>
      </div>
    </header>
  );
}
