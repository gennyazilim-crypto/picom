import { AppIcon } from "./AppIcon";
import { useTranslation } from "../i18n";
import type { MentionFeedTab } from "../types/mentions";

type MentionFeedTabsProps = {
  activeTab: MentionFeedTab;
  feedCount: number;
  followingCount: number;
  onTabChange: (tab: MentionFeedTab) => void;
};

export function MentionFeedTabs({ activeTab, feedCount, followingCount, onTabChange }: MentionFeedTabsProps) {
  const { t } = useTranslation("feed");
  return (
    <div className="mention-tabs mention-tabs--segmented" role="tablist" aria-label={t("tabs.aria")}>
      <button
        className={activeTab === "feed" ? "active" : ""}
        type="button"
        role="tab"
        aria-selected={activeTab === "feed"}
        onClick={() => onTabChange("feed")}
      >
        <AppIcon name="home" size="xs" />
        <span className="mention-tab-label">{t("tabs.feed")}</span>
        <span className="mention-tab-count" aria-label={t("posts.count", { count: feedCount })}>
          {feedCount}
        </span>
      </button>
      <button
        className={activeTab === "following" ? "active" : ""}
        type="button"
        role="tab"
        aria-selected={activeTab === "following"}
        title={t("tabs.followingTitle")}
        onClick={() => onTabChange("following")}
      >
        <AppIcon name="users" size="xs" />
        <span className="mention-tab-label">{t("tabs.following")}</span>
        <span className="mention-tab-count" aria-label={t("posts.count", { count: followingCount })}>
          {followingCount}
        </span>
      </button>
    </div>
  );
}
