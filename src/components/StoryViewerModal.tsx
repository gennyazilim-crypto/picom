import { useEffect, type MouseEvent } from "react";
import type { Community, Member } from "../types/community";
import type { FollowedUserStory } from "../types/stories";
import { useDialogFocusTrap } from "../hooks/useDialogFocusTrap";
import { AppIcon } from "./AppIcon";
import { MemberAvatar } from "./MemberAvatar";

type StoryViewerModalProps = {
  story: FollowedUserStory;
  stories: FollowedUserStory[];
  author: Member;
  communities: Community[];
  onCloseStory: () => void;
  onPreviousStory: () => void;
  onNextStory: () => void;
  onOpenStoryProfile: (event: MouseEvent, member: Member) => void;
  onOpenStoryInChannel: (story: FollowedUserStory) => void;
};

function getCommunityName(communities: Community[], communityId?: string) {
  if (!communityId) return "Picom";
  return communities.find((community) => community.id === communityId)?.name ?? "Picom";
}

function getChannelName(communities: Community[], story: FollowedUserStory) {
  const community = communities.find((candidate) => candidate.id === story.communityId);
  const channel = community?.categories.flatMap((category) => category.channels).find((candidate) => candidate.id === story.channelId);
  return channel ? `#${channel.name}` : undefined;
}

export function StoryProgressBar({ stories, activeStoryId }: { stories: FollowedUserStory[]; activeStoryId: string }) {
  const activeIndex = stories.findIndex((story) => story.id === activeStoryId);
  return <div className="story-progress-bar" aria-hidden="true">{stories.map((story, index) => <span key={story.id} className={index === activeIndex ? "active" : index < activeIndex ? "complete" : ""} />)}</div>;
}

export function StoryViewerControls({ onPreviousStory, onNextStory }: Pick<StoryViewerModalProps, "onPreviousStory" | "onNextStory">) {
  return <div className="story-viewer-controls"><button className="previous" type="button" aria-label="Previous story" onClick={onPreviousStory}><AppIcon name="chevronRight" size="md" /></button><button type="button" aria-label="Next story" onClick={onNextStory}><AppIcon name="chevronRight" size="md" /></button></div>;
}

export function StoryViewerModal({ story, stories, author, communities, onCloseStory, onPreviousStory, onNextStory, onOpenStoryProfile, onOpenStoryInChannel }: StoryViewerModalProps) {
  const channelName = getChannelName(communities, story);
  const dialogRef = useDialogFocusTrap<HTMLElement>(onCloseStory);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") onPreviousStory();
      if (event.key === "ArrowRight") onNextStory();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onNextStory, onPreviousStory]);

  return (
    <div className="story-viewer-backdrop" role="presentation" onMouseDown={onCloseStory}>
      <section ref={dialogRef} tabIndex={-1} className="story-viewer-modal" role="dialog" aria-modal="true" aria-label={`${author.displayName} story`} onMouseDown={(event) => event.stopPropagation()}>
        <StoryProgressBar stories={stories} activeStoryId={story.id} />
        <button className="story-viewer-close" type="button" aria-label="Close story viewer" onClick={onCloseStory}><AppIcon name="close" size="md" /></button>
        <div className={`story-viewer-art ${story.gradient ?? "story-bg-ocean"}`}>
          <span className="story-card-art" aria-hidden="true"><i className="story-blob one" /><i className="story-blob two" /><i className="story-line" /></span>
          <div className="story-viewer-author"><button type="button" onClick={(event) => onOpenStoryProfile(event, author)}><MemberAvatar member={author} size={38} /><span><strong>{author.displayName}</strong><small>@{author.username} - {story.timeLabel}</small></span></button></div>
          <div className="story-viewer-copy"><small>{story.subtitle ?? story.type.replace("_", " ")}</small><h2>{story.title}</h2>{story.body ? <p>{story.body}</p> : null}<span>{getCommunityName(communities, story.communityId)}{channelName ? ` / ${channelName}` : ""}</span></div>
        </div>
        <StoryViewerControls onPreviousStory={onPreviousStory} onNextStory={onNextStory} />
        {story.communityId && story.channelId ? <button className="story-open-channel" type="button" onClick={() => onOpenStoryInChannel(story)}><AppIcon name="chevronRight" size="sm" />Open in channel</button> : null}
      </section>
    </div>
  );
}
