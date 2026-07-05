import { useEffect, useMemo, useState } from "react";
import type { Community, UserId } from "../types/community";
import type { CommunityOnboardingItemId } from "../types/communityOnboarding";
import { communityOnboardingService } from "../services/communityOnboardingService";
import { AppIcon, type IconName } from "./AppIcon";

type CommunityOnboardingChecklistProps = {
  community: Community;
  currentUserId: UserId;
};

const itemIcons: Record<CommunityOnboardingItemId, IconName> = {
  set_icon: "image",
  add_description: "edit",
  create_first_channel: "hash",
  invite_people: "users",
  set_rules: "lock",
  configure_roles: "settings",
  send_first_message: "send",
  configure_notifications: "bell",
};

export function CommunityOnboardingChecklist({ community, currentUserId }: CommunityOnboardingChecklistProps) {
  const [state, setState] = useState(() => communityOnboardingService.getState(community.id, currentUserId));

  const items = useMemo(() => communityOnboardingService.getItems(), []);
  const completed = communityOnboardingService.getCompletedItems(community, currentUserId);
  const completedCount = items.filter((item) => completed[item.id]).length;
  const progress = Math.round((completedCount / items.length) * 100);

  useEffect(() => {
    setState(communityOnboardingService.getState(community.id, currentUserId));
  }, [community.id, currentUserId]);

  if (state.dismissed) {
    return null;
  }

  function toggleItem(itemId: CommunityOnboardingItemId) {
    const next = communityOnboardingService.setItemCompleted(community.id, currentUserId, itemId, !completed[itemId]);
    setState(next);
  }

  function dismissChecklist() {
    setState(communityOnboardingService.dismiss(community.id, currentUserId));
  }

  return (
    <section className="community-onboarding-card" aria-label="Community onboarding checklist">
      <div className="community-onboarding-head">
        <div>
          <span>Owner setup</span>
          <strong>Launch checklist</strong>
        </div>
        <button type="button" className="onboarding-dismiss" onClick={dismissChecklist} aria-label="Dismiss community onboarding checklist">
          <AppIcon name="close" size="xs" />
        </button>
      </div>

      <div className="onboarding-progress" aria-label={`${completedCount} of ${items.length} setup steps completed`}>
        <span style={{ width: `${progress}%` }} />
      </div>

      <div className="onboarding-summary">
        {completedCount}/{items.length} complete
      </div>

      <div className="onboarding-items">
        {items.map((item) => {
          const isComplete = Boolean(completed[item.id]);

          return (
            <button
              type="button"
              key={item.id}
              className={`onboarding-item${isComplete ? " complete" : ""}`}
              onClick={() => toggleItem(item.id)}
              aria-pressed={isComplete}
            >
              <span className="onboarding-item-icon">
                <AppIcon name={itemIcons[item.id]} size="sm" />
              </span>
              <span className="onboarding-item-copy">
                <strong>{item.title}</strong>
                <small>{item.description}</small>
              </span>
              <span className="onboarding-item-state">{isComplete ? "Done" : item.actionLabel}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
