import { useEffect, type MouseEvent } from "react";
import type { Community, Member } from "../types/community";
import type { FollowedUserStory } from "../types/stories";
import { AppIcon } from "./AppIcon";
import { MemberAvatar } from "./MemberAvatar";

type FollowedPeopleStoriesHeaderProps = {
  stories: FollowedUserStory[];
  communities: Community[];
  activeStoryId: string | null;
  onOpenStory: (storyId: string) => void;
  onCloseStory: () => void;
  onPreviousStory: () => void;
  onNextStory: () => void;
  onOpenStoryProfile: (event: MouseEvent, member: Member) => void;
  onOpenStoryInChannel: (story: FollowedUserStory) => void;
};

function findMember(communities: Community[], userId: string) {
  return communities.flatMap((community) => community.members).find((member) => member.userId === userId);
}

function getStoryAuthor(communities: Community[], story: FollowedUserStory): Member {
  return findMember(communities, story.authorId) ?? {
    id: `story-author-${story.authorId}`,
    userId: story.authorId,
    displayName: "Picom member",
    username: story.authorId,
    avatarSeed: story.authorId,
    status: "online",
    statusText: "Following",
    roleId: "member",
  };
}

function getCommunityName(communities: Community[], communityId?: string) {
  if (!communityId) return "Picom";
  return communities.find((community) => community.id === communityId)?.name ?? "Picom";
}

function getChannelName(communities: Community[], story: FollowedUserStory) {
  const community = communities.find((candidate) => candidate.id === story.communityId);
  const channel = community?.categories.flatMap((category) => category.channels).find((candidate) => candidate.id === story.channelId);
  return channel ? `#${channel.name}` : undefined;
}

export function StoryCard({ story, author, onOpenStory }: { story: FollowedUserStory; author: Member; onOpenStory: (storyId: string) => void }) {
  return (
    <button
      className={`story-card ${story.status === "unseen" ? "unseen" : "seen"} ${story.gradient ?? "story-bg-ocean"}`}
      type="button"
      aria-label={`Open story by ${author.displayName}: ${story.title}`}
      onClick={() => onOpenStory(story.id)}
    >
      <span className="story-card-art" aria-hidden="true">
        <i className="story-blob one" />
        <i className="story-blob two" />
        <i className="story-line" />
      </span>
      <span className="story-user-pill">
        <MemberAvatar member={author} size={20} />
        <span>
          <strong>{author.displayName}</strong>
          <small>@{author.username}</small>
        </span>
      </span>
      <span className="story-time-badge">{story.timeLabel}</span>
      <span className="story-bottom-overlay">
        <small>{story.subtitle ?? story.type.replace("_", " ")}</small>
        <strong>{story.title}</strong>
      </span>
    </button>
  );
}

export function StoryCardGrid({ stories, communities, onOpenStory }: { stories: FollowedUserStory[]; communities: Community[]; onOpenStory: (storyId: string) => void }) {
  return (
    <div className="story-card-grid" aria-label="Followed people stories">
      {stories.map((story) => (
        <StoryCard key={story.id} story={story} author={getStoryAuthor(communities, story)} onOpenStory={onOpenStory} />
      ))}
    </div>
  );
}

export function StoryProgressBar({ stories, activeStoryId }: { stories: FollowedUserStory[]; activeStoryId: string }) {
  const activeIndex = stories.findIndex((story) => story.id === activeStoryId);

  return (
    <div className="story-progress-bar" aria-hidden="true">
      {stories.map((story, index) => (
        <span key={story.id} className={index === activeIndex ? "active" : index < activeIndex ? "complete" : ""} />
      ))}
    </div>
  );
}

export function StoryViewerControls({ onPreviousStory, onNextStory }: Pick<FollowedPeopleStoriesHeaderProps, "onPreviousStory" | "onNextStory">) {
  return (
    <div className="story-viewer-controls">
      <button className="previous" type="button" aria-label="Previous story" onClick={onPreviousStory}>
        <AppIcon name="chevronRight" size="md" />
      </button>
      <button type="button" aria-label="Next story" onClick={onNextStory}>
        <AppIcon name="chevronRight" size="md" />
      </button>
    </div>
  );
}

export function StoryViewerModal({
  story,
  stories,
  author,
  communities,
  onCloseStory,
  onPreviousStory,
  onNextStory,
  onOpenStoryProfile,
  onOpenStoryInChannel,
}: {
  story: FollowedUserStory;
  stories: FollowedUserStory[];
  author: Member;
  communities: Community[];
} & Pick<FollowedPeopleStoriesHeaderProps, "onCloseStory" | "onPreviousStory" | "onNextStory" | "onOpenStoryProfile" | "onOpenStoryInChannel">) {
  const channelName = getChannelName(communities, story);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseStory();
      if (event.key === "ArrowLeft") onPreviousStory();
      if (event.key === "ArrowRight") onNextStory();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCloseStory, onNextStory, onPreviousStory]);

  return (
    <div className="story-viewer-backdrop" role="presentation" onMouseDown={onCloseStory}>
      <section className="story-viewer-modal" role="dialog" aria-modal="true" aria-label={`${author.displayName} story`} onMouseDown={(event) => event.stopPropagation()}>
        <StoryProgressBar stories={stories} activeStoryId={story.id} />
        <button className="story-viewer-close" type="button" aria-label="Close story viewer" onClick={onCloseStory}>
          <AppIcon name="close" size="md" />
        </button>
        <div className={`story-viewer-art ${story.gradient ?? "story-bg-ocean"}`}>
          <span className="story-card-art" aria-hidden="true">
            <i className="story-blob one" />
            <i className="story-blob two" />
            <i className="story-line" />
          </span>
          <div className="story-viewer-author">
            <button type="button" onClick={(event) => onOpenStoryProfile(event, author)}>
              <MemberAvatar member={author} size={38} />
              <span>
                <strong>{author.displayName}</strong>
                <small>@{author.username} - {story.timeLabel}</small>
              </span>
            </button>
          </div>
          <div className="story-viewer-copy">
            <small>{story.subtitle ?? story.type.replace("_", " ")}</small>
            <h2>{story.title}</h2>
            {story.body ? <p>{story.body}</p> : null}
            <span>{getCommunityName(communities, story.communityId)}{channelName ? ` / ${channelName}` : ""}</span>
          </div>
        </div>
        <StoryViewerControls onPreviousStory={onPreviousStory} onNextStory={onNextStory} />
        {story.communityId && story.channelId ? (
          <button className="story-open-channel" type="button" onClick={() => onOpenStoryInChannel(story)}>
            <AppIcon name="chevronRight" size="sm" />
            Open in channel
          </button>
        ) : null}
      </section>
    </div>
  );
}

export function FollowedPeopleStoriesHeader({
  stories,
  communities,
  activeStoryId,
  onOpenStory,
  onCloseStory,
  onPreviousStory,
  onNextStory,
  onOpenStoryProfile,
  onOpenStoryInChannel,
}: FollowedPeopleStoriesHeaderProps) {
  const activeStory = stories.find((story) => story.id === activeStoryId) ?? null;
  const activeAuthor = activeStory ? getStoryAuthor(communities, activeStory) : null;

  return (
    <section className="followed-stories-header" aria-label="Following stories">
      <div className="followed-stories-heading">
        <div>
          <p className="eyebrow">Following Stories</p>
          <h1>Takip Ettiklerin</h1>
        </div>
        <span>Updates from people you follow</span>
      </div>
      <StoryCardGrid stories={stories} communities={communities} onOpenStory={onOpenStory} />
      {activeStory && activeAuthor ? (
        <StoryViewerModal
          story={activeStory}
          stories={stories}
          author={activeAuthor}
          communities={communities}
          onCloseStory={onCloseStory}
          onPreviousStory={onPreviousStory}
          onNextStory={onNextStory}
          onOpenStoryProfile={onOpenStoryProfile}
          onOpenStoryInChannel={onOpenStoryInChannel}
        />
      ) : null}
    </section>
  );
}
