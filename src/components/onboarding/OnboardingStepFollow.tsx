import type { Member } from "../../types/community";
import { AppIcon } from "../AppIcon";
import { MemberAvatar } from "../MemberAvatar";

type Props = { suggestions: Member[]; followedUserIds: string[]; onToggleFollow: (userId: string) => void };

export function OnboardingStepFollow({ suggestions, followedUserIds, onToggleFollow }: Props) {
  return (
    <section className="onboarding-step" aria-labelledby="onboarding-follow-title">
      <div className="onboarding-step-heading"><span className="onboarding-step-icon"><AppIcon name="users" size="lg" /></span><div><p className="eyebrow">Follow suggestions</p><h2 id="onboarding-follow-title">Build a useful feed</h2><p>Select people to make your followed-people feed useful from day one.</p></div></div>
      <div className="onboarding-follow-list">
        {suggestions.slice(0, 10).map((member) => {
          const following = followedUserIds.includes(member.userId);
          return <article className="onboarding-follow-row" key={member.userId}><MemberAvatar member={member} size={42} /><div><strong>{member.displayName}</strong><span>@{member.username} - {member.statusText}</span></div><button type="button" className={following ? "selected" : ""} onClick={() => onToggleFollow(member.userId)}>{following ? "Following" : "Follow"}</button></article>;
        })}
      </div>
    </section>
  );
}

